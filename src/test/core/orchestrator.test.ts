import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { Orchestrator } from '../../core/orchestrator';
import { SidecarService } from '../../services/sidecarService';
import { StatusBarManager } from '../../ui/statusBarManager';
import { DashboardViewProvider } from '../../ui/dashboardViewProvider';

describe('Orchestrator Tests', () => {
  let orchestrator: Orchestrator;
  let context: any;
  let sidecarStub: sinon.SinonStubbedInstance<SidecarService>;
  let statusBarStub: sinon.SinonStubbedInstance<StatusBarManager>;
  let dashboardStub: sinon.SinonStubbedInstance<DashboardViewProvider>;

  beforeEach(() => {
    // Mock VS Code context
    context = {
      subscriptions: [],
      extensionUri: { fsPath: '/test/path' },
      globalState: {
        get: vi.fn(),
        update: vi.fn()
      }
    };

    // Stubs for internal components
    sidecarStub = sinon.createStubInstance(SidecarService);
    statusBarStub = sinon.createStubInstance(StatusBarManager);
    dashboardStub = sinon.createStubInstance(DashboardViewProvider);

    // Mock Orchestrator to use our stubs
    orchestrator = new Orchestrator(context as vscode.ExtensionContext);
    (orchestrator as any).sidecar = sidecarStub;
    (orchestrator as any).statusBar = statusBarStub;
    (orchestrator as any).dashboard = dashboardStub;
  });

  afterEach(() => {
    sinon.restore();
  });

  it('initializes and starts polling', async () => {
    const startPollingSpy = vi.spyOn(orchestrator, 'startPolling');
    const refreshSpy = vi.spyOn(orchestrator, 'refresh');
    
    await orchestrator.init();
    
    expect(startPollingSpy).toHaveBeenCalled();
    expect(refreshSpy).toHaveBeenCalled();
  });

  it('triggers notification on 1.0 reset', async () => {
    // Setup state
    context.globalState.get.mockReturnValue(true); // notifyOnReset = true
    (orchestrator as any).previousFractions = { 'claude': 0.5 };
    
    const mockStatus = {
      modelConfigs: [
        { label: 'claude', quotaInfo: { remainingFraction: 1.0 } }
      ]
    };
    
    sidecarStub.fetchUserStatus.resolves(mockStatus as any);
    
    const showMsgStub = sinon.stub(vscode.window, 'showInformationMessage');
    
    await orchestrator.refresh();
    
    expect(showMsgStub.calledWith(sinon.match('fully reset'))).toBe(true);
    expect((orchestrator as any).previousFractions['claude']).toBe(1.0);
  });

  it('does not notify if reset detection is disabled', async () => {
    context.globalState.get.mockReturnValue(false); // notifyOnReset = false
    (orchestrator as any).previousFractions = { 'claude': 0.5 };
    
    const mockStatus = {
      modelConfigs: [
        { label: 'claude', quotaInfo: { remainingFraction: 1.0 } }
      ]
    };
    
    sidecarStub.fetchUserStatus.resolves(mockStatus as any);
    const showMsgStub = sinon.stub(vscode.window, 'showInformationMessage');
    
    await orchestrator.refresh();
    
    expect(showMsgStub.called).toBe(false);
  });

  it('triggers warning notification when model quota falls below notificationThreshold', async () => {
    sinon.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key: string, def: any) => {
        if (key === 'notificationThreshold') return 20;
        return def;
      }
    } as any);

    const mockStatus = {
      modelConfigs: [
        { label: 'Gemini 1.5 Pro (High)', quotaInfo: { remainingFraction: 0.15 } }
      ]
    };
    sidecarStub.fetchUserStatus.resolves(mockStatus as any);
    const warnStub = sinon.stub(vscode.window, 'showWarningMessage');

    await orchestrator.refresh();

    expect(warnStub.calledOnce).toBe(true);
    expect(warnStub.calledWith(sinon.match('Gemini 1.5 Pro (High) quota is low (15% remaining)!'))).toBe(true);

    // Second refresh with same low quota should not spam notification
    await orchestrator.refresh();
    expect(warnStub.calledOnce).toBe(true);

    // If quota resets back to 1.0, warning flag is cleared
    const resetStatus = {
      modelConfigs: [
        { label: 'Gemini 1.5 Pro (High)', quotaInfo: { remainingFraction: 1.0 } }
      ]
    };
    sidecarStub.fetchUserStatus.resolves(resetStatus as any);
    await orchestrator.refresh();

    // Now drops again -> should warn again
    sidecarStub.fetchUserStatus.resolves(mockStatus as any);
    await orchestrator.refresh();
    expect(warnStub.calledTwice).toBe(true);
  });

  it('maps refreshRate to appropriate polling intervals', () => {
    const clock = sinon.useFakeTimers();
    try {
      const getConfStub = sinon.stub(vscode.workspace, 'getConfiguration');

      // Test "Real-time" -> interval set
      getConfStub.returns({
        get: (key: string) => key === 'refreshRate' ? 'Real-time' : undefined
      } as any);
      orchestrator.startPolling();
      expect((orchestrator as any).pollInterval).not.toBeNull();

      // Test "Manual" -> interval cleared
      getConfStub.returns({
        get: (key: string) => key === 'refreshRate' ? 'Manual' : undefined
      } as any);
      orchestrator.startPolling();
      expect((orchestrator as any).pollInterval).toBeNull();
    } finally {
      clock.restore();
    }
  });

  it('does not apply adaptive backoff when user has remaining quota on active models', () => {
    sinon.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key: string, def: any) => {
        if (key === 'adaptivePolling') return true;
        return def;
      }
    } as any);

    const activeStatus: any = {
      modelConfigs: [
        { label: 'Gemini Pro', quotaInfo: { remainingFraction: 0.5, resetTime: new Date(Date.now() + 7200000).toISOString() } },
        { label: 'Claude', quotaInfo: { remainingFraction: 0.0, resetTime: new Date(Date.now() + 3600000).toISOString() } }
      ]
    };

    const delay = orchestrator.calculateNextDelay(activeStatus);
    expect(delay).toBeUndefined(); // Normal rate maintained
  });

  it('applies stepped precision backoff when all active models are at 0%', () => {
    sinon.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key: string, def: any) => {
        if (key === 'adaptivePolling') return true;
        return def;
      }
    } as any);

    // Case 1: > 1 hour left -> 30 minutes (1800000ms)
    const exhaustedFarStatus: any = {
      modelConfigs: [
        { label: 'Gemini Pro', quotaInfo: { remainingFraction: 0.0, resetTime: new Date(Date.now() + 3 * 3600000).toISOString() } },
        { label: 'Claude', quotaInfo: { remainingFraction: 0.0, resetTime: new Date(Date.now() + 4 * 3600000).toISOString() } }
      ]
    };
    expect(orchestrator.calculateNextDelay(exhaustedFarStatus)).toBe(30 * 60 * 1000);

    // Case 2: 15m to 60m left -> 10 minutes (600000ms)
    const exhaustedMidStatus: any = {
      modelConfigs: [
        { label: 'Gemini Pro', quotaInfo: { remainingFraction: 0.0, resetTime: new Date(Date.now() + 30 * 60000).toISOString() } }
      ]
    };
    expect(orchestrator.calculateNextDelay(exhaustedMidStatus)).toBe(10 * 60 * 1000);

    // Case 3: 1m to 15m left (e.g. 5 minutes = 300,000ms) -> capped at 60s
    const exhausted1to15Status: any = {
      modelConfigs: [
        { label: 'Gemini Pro', quotaInfo: { remainingFraction: 0.0, resetTime: new Date(Date.now() + 5 * 60000).toISOString() } }
      ]
    };
    expect(orchestrator.calculateNextDelay(exhausted1to15Status)).toBe(60 * 1000);

    // Case 4: <= 1m left (e.g. 45 seconds) -> poll every 15s
    const exhaustedNearStatus: any = {
      modelConfigs: [
        { label: 'Gemini Pro', quotaInfo: { remainingFraction: 0.0, resetTime: new Date(Date.now() + 45000).toISOString() } }
      ]
    };
    expect(orchestrator.calculateNextDelay(exhaustedNearStatus)).toBe(15 * 1000);
  });

  it('disables adaptive backoff when adaptivePolling is turned off in settings', () => {
    sinon.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key: string, def: any) => {
        if (key === 'adaptivePolling') return false;
        return def;
      }
    } as any);

    const exhaustedStatus: any = {
      modelConfigs: [
        { label: 'Gemini Pro', quotaInfo: { remainingFraction: 0.0, resetTime: new Date(Date.now() + 3 * 3600000).toISOString() } }
      ]
    };

    const delay = orchestrator.calculateNextDelay(exhaustedStatus);
    expect(delay).toBeUndefined(); // Normal rate maintained
  });

  it('fetches trajectories and passes them to dashboard during refresh', async () => {
    const mockStatus: any = {
      modelConfigs: []
    };
    const mockTrajectories: any = {
      'session-1': { summary: 'Coding Session', stepCount: 10 }
    };
    sidecarStub.fetchUserStatus.resolves(mockStatus);
    sidecarStub.fetchTrajectories.resolves(mockTrajectories);

    await orchestrator.refresh();

    expect(dashboardStub.update.calledWith(mockStatus, mockTrajectories)).toBe(true);
  });

  it('handles trajectory fetching errors gracefully during refresh', async () => {
    const mockStatus: any = {
      modelConfigs: []
    };
    sidecarStub.fetchUserStatus.resolves(mockStatus);
    sidecarStub.fetchTrajectories.rejects(new Error('Trajectories failed'));

    await orchestrator.refresh();

    expect(dashboardStub.update.calledWith(mockStatus, null)).toBe(true);
  });

  it('schedules next poll correctly for 5m and default intervals', () => {
    const getConfStub = sinon.stub(vscode.workspace, 'getConfiguration');

    getConfStub.returns({
      get: (key: string, def?: any) => {
        if (key === 'refreshRate') return '5m';
        return def;
      }
    } as any);
    orchestrator.scheduleNextPoll();
    expect((orchestrator as any).pollInterval).not.toBeNull();

    // Default interval fallback
    getConfStub.returns({
      get: (key: string, def?: any) => {
        if (key === 'refreshRate') return 'custom';
        if (key === 'autoUpdateInterval') return 120;
        return def;
      }
    } as any);
    orchestrator.scheduleNextPoll();
    expect((orchestrator as any).pollInterval).not.toBeNull();
  });

  it('disposes poll interval and status bar upon dispose', () => {
    orchestrator.startPolling();
    expect((orchestrator as any).pollInterval).not.toBeNull();

    orchestrator.dispose();
    expect((orchestrator as any).pollInterval).toBeNull();
    expect(statusBarStub.dispose.calledOnce).toBe(true);
  });
});

