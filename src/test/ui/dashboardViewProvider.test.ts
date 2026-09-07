import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { DashboardViewProvider } from '../../ui/dashboardViewProvider';
import { UserStatus } from '../../types';

describe('DashboardViewProvider History & Sparkline Tests', () => {
  let provider: DashboardViewProvider;
  let mockState: Record<string, any>;
  let mockContext: any;

  beforeEach(() => {
    mockState = {};
    mockContext = {
      globalState: {
        get: (key: string, defaultVal?: any) => (key in mockState ? mockState[key] : defaultVal),
        update: (key: string, val: any) => {
          mockState[key] = val;
          return Promise.resolve();
        },
      },
      extensionPath: '/mock/path',
      extensionUri: { fsPath: '/mock/path' },
      subscriptions: [],
    };
    provider = new DashboardViewProvider(mockContext);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('attributes shared Gemini pool usage only to Gemini Flash when Flash is the active model', () => {
    const initialStatus: UserStatus = {
      email: 'test@example.com',
      tier: 'Pro',
      activeModel: 'MODEL_M318',
      activeModelLabel: 'Gemini 3.8 Flash (Medium)',
      modelConfigs: [
        { label: 'Gemini 3.8 Flash (Medium)', quotaInfo: { remainingFraction: 0.30 } },
        { label: 'Gemini 3.7 Flash (High)', quotaInfo: { remainingFraction: 0.30 } },
        { label: 'Gemini 3.6 Flash (Low)', quotaInfo: { remainingFraction: 0.30 } },
        { label: 'Gemini 3.1 Pro (High)', quotaInfo: { remainingFraction: 0.30 } },
      ],
      promptCredits: 0,
      availablePromptCredits: 0,
      flowCredits: 0,
      availableFlowCredits: 0,
    };

    (provider as any)._updateUsageHistory(initialStatus);

    mockState['zeroquota.lastHistoryUpdate'] = Date.now() - 120000;
    const updatedStatus: UserStatus = {
      ...initialStatus,
      modelConfigs: [
        { label: 'Gemini 3.8 Flash (Medium)', quotaInfo: { remainingFraction: 0.25 } },
        { label: 'Gemini 3.7 Flash (High)', quotaInfo: { remainingFraction: 0.25 } },
        { label: 'Gemini 3.6 Flash (Low)', quotaInfo: { remainingFraction: 0.25 } },
        { label: 'Gemini 3.1 Pro (High)', quotaInfo: { remainingFraction: 0.25 } },
      ],
    };

    (provider as any)._updateUsageHistory(updatedStatus);

    const history = (provider as any)._usageHistory;
    expect(history['Gemini Flash'].length).toBe(2);
    expect(history['Gemini Flash'][1]).toBeCloseTo(0.05, 4);

    expect(history['Gemini Pro'].length).toBe(2);
    expect(history['Gemini Pro'][1]).toBe(0);
  });

  it('attributes shared Gemini pool usage only to Gemini Pro when Pro is the active model', () => {
    const initialStatus: UserStatus = {
      email: 'test@example.com',
      tier: 'Pro',
      activeModel: 'MODEL_M16',
      activeModelLabel: 'Gemini 3.1 Pro (High)',
      modelConfigs: [
        { label: 'Gemini 3.8 Flash (Medium)', quotaInfo: { remainingFraction: 0.40 } },
        { label: 'Gemini 3.1 Pro (High)', quotaInfo: { remainingFraction: 0.40 } },
      ],
      promptCredits: 0,
      availablePromptCredits: 0,
      flowCredits: 0,
      availableFlowCredits: 0,
    };

    (provider as any)._updateUsageHistory(initialStatus);

    mockState['zeroquota.lastHistoryUpdate'] = Date.now() - 120000;
    const updatedStatus: UserStatus = {
      ...initialStatus,
      modelConfigs: [
        { label: 'Gemini 3.8 Flash (Medium)', quotaInfo: { remainingFraction: 0.32 } },
        { label: 'Gemini 3.1 Pro (High)', quotaInfo: { remainingFraction: 0.32 } },
      ],
    };

    (provider as any)._updateUsageHistory(updatedStatus);

    const history = (provider as any)._usageHistory;
    expect(history['Gemini Pro'][1]).toBeCloseTo(0.08, 4);
    expect(history['Gemini Flash'][1]).toBe(0);
  });

  it('does not flood history with duplicate zeroes even when multiple model variants exist', () => {
    const status: UserStatus = {
      email: 'test@example.com',
      tier: 'Pro',
      activeModelLabel: 'Gemini 3.8 Flash (Medium)',
      modelConfigs: [
        { label: 'Gemini 3.8 Flash (High)', quotaInfo: { remainingFraction: 0.50 } },
        { label: 'Gemini 3.8 Flash (Medium)', quotaInfo: { remainingFraction: 0.50 } },
        { label: 'Gemini 3.8 Flash (Low)', quotaInfo: { remainingFraction: 0.50 } },
        { label: 'Gemini 3.7 Flash (High)', quotaInfo: { remainingFraction: 0.50 } },
        { label: 'Gemini 3.7 Flash (Medium)', quotaInfo: { remainingFraction: 0.50 } },
        { label: 'Gemini 3.7 Flash (Low)', quotaInfo: { remainingFraction: 0.50 } },
        { label: 'Gemini 3.6 Flash (High)', quotaInfo: { remainingFraction: 0.50 } },
        { label: 'Gemini 3.6 Flash (Medium)', quotaInfo: { remainingFraction: 0.50 } },
        { label: 'Gemini 3.6 Flash (Low)', quotaInfo: { remainingFraction: 0.50 } },
        { label: 'Gemini 3.1 Pro (High)', quotaInfo: { remainingFraction: 0.50 } },
        { label: 'Gemini 3.1 Pro (Low)', quotaInfo: { remainingFraction: 0.50 } },
      ],
      promptCredits: 0,
      availablePromptCredits: 0,
      flowCredits: 0,
      availableFlowCredits: 0,
    };

    (provider as any)._updateUsageHistory(status);

    const history = (provider as any)._usageHistory;
    expect(history['Gemini Flash'].length).toBe(1);
    expect(history['Gemini Pro'].length).toBe(1);
  });

  it('resolves webview view and handles webview commands and messages', async () => {
    const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
    let messageHandler: ((msg: any) => void) | undefined;
    let disposeHandler: (() => void) | undefined;

    const mockWebviewView: any = {
      webview: {
        options: {},
        html: '',
        asWebviewUri: (uri: any) => uri,
        onDidReceiveMessage: (cb: any) => { messageHandler = cb; },
      },
      visible: true,
      onDidDispose: (cb: any) => { disposeHandler = cb; },
      onDidChangeVisibility: vi.fn(),
    };

    provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
    await vi.waitFor(() => {
      expect(mockWebviewView.webview.html).toContain('ZeroQuota');
    }, { timeout: 2000 });

    expect(mockWebviewView.webview.options.enableScripts).toBe(true);
    expect(messageHandler).toBeDefined();

    // Test commands dispatched from Webview
    messageHandler!({ command: 'openLocalSettings' });
    expect(executeCommandStub.calledWith('workbench.action.openSettings', 'zeroquota')).toBe(true);

    messageHandler!({ command: 'refresh' });
    expect(executeCommandStub.calledWith('zeroquota.refresh')).toBe(true);

    messageHandler!({ command: 'rules' });
    expect(executeCommandStub.calledWith('zeroquota.openRules')).toBe(true);

    messageHandler!({ command: 'skills' });
    expect(executeCommandStub.calledWith('zeroquota.openSkills')).toBe(true);

    messageHandler!({ command: 'workflows' });
    expect(executeCommandStub.calledWith('zeroquota.openSkills')).toBe(true);

    messageHandler!({ command: 'mcp' });
    expect(executeCommandStub.calledWith('zeroquota.openMcpConfig')).toBe(true);

    messageHandler!({ command: 'reload' });
    expect(executeCommandStub.calledWith('zeroquota.reload')).toBe(true);

    messageHandler!({ command: 'openFile', path: '/test/path/file.txt' });
    expect(executeCommandStub.calledWith('vscode.open', sinon.match((uri: any) => uri.fsPath === '/test/path/file.txt'))).toBe(true);

    // Test persistSectionState
    messageHandler!({ command: 'persistSectionState', section: 'model-usage', collapsed: true });
    expect((provider as any)._collapsedSections['model-usage']).toBe(true);

    // Test persistSettingsState
    messageHandler!({ command: 'persistSettingsState', visible: true });
    expect((provider as any)._settingsVisible).toBe(true);

    // Test saveSettings
    const updateConfigStub = sinon.stub();
    sinon.stub(vscode.workspace, 'getConfiguration').returns({
      get: sinon.stub().returns(undefined),
      update: updateConfigStub.resolves()
    } as any);

    messageHandler!({
      command: 'saveSettings',
      settings: {
        threshold: 20,
        notifyOnReset: true,
        modelPicker: { geminiPro: true },
        refreshRate: '5m',
        adaptivePolling: false,
        autoSyncBrain: false,
      }
    });

    // Cleanup webview disposal
    disposeHandler!();
    expect((provider as any)._view).toBeUndefined();
  });

  it('updates HTML and stores cascade trajectories when update is called', async () => {
    const mockWebviewView: any = {
      webview: {
        options: {},
        html: '',
        asWebviewUri: (uri: any) => uri,
        onDidReceiveMessage: vi.fn(),
      },
      visible: true,
      onDidDispose: vi.fn(),
      onDidChangeVisibility: vi.fn(),
    };

    provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

    const testStatus: UserStatus = {
      email: 'user@example.com',
      tier: 'Google AI Pro',
      modelConfigs: [
        { label: 'Gemini 3 Pro', quotaInfo: { remainingFraction: 0.85 } }
      ],
      promptCredits: 100,
      availablePromptCredits: 100,
      flowCredits: 100,
      availableFlowCredits: 100,
    };

    const testTrajectories = {
      'traj-alpha': {
        summary: 'Feature Implementation',
        stepCount: 25,
        lastModifiedTime: '2026-09-07T14:00:00Z',
      }
    };

    provider.update(testStatus, testTrajectories);
    await vi.waitFor(() => {
      expect(mockWebviewView.webview.html).toContain('user@example.com');
    }, { timeout: 2000 });

    expect((provider as any)._latestStatus).toBe(testStatus);
    expect((provider as any)._trajectories).toBe(testTrajectories);
  });
});

