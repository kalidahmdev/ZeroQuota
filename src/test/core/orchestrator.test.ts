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
});
