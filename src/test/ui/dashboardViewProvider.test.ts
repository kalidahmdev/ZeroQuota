import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  DashboardViewProvider,
  isBrainMetadataFile,
  brainHasVisibleContent,
} from '../../ui/dashboardViewProvider';
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

  it('shows a visible error state instead of hanging when rendering throws', async () => {
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

    // Force the synchronous HTML builder to throw mid-render.
    (provider as any)._getHtmlForWebview = () => {
      throw new Error('boom');
    };

    provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

    await vi.waitFor(() => {
      expect(mockWebviewView.webview.html).toContain('failed to render');
    }, { timeout: 2000 });
    expect(mockWebviewView.webview.html).toContain('boom');
  });

  it('dispose clears the refresh interval and releases the view', () => {
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
    expect((provider as any)._updateInterval).toBeDefined();

    provider.dispose();

    expect((provider as any)._updateInterval).toBeUndefined();
    expect((provider as any)._view).toBeUndefined();
  });
});

describe('isBrainMetadataFile', () => {
  it('matches metadata sidecars case-insensitively', () => {
    expect(isBrainMetadataFile('x.metadata')).toBe(true);
    expect(isBrainMetadataFile('x.metadata.json')).toBe(true);
    expect(isBrainMetadataFile('X.METADATA')).toBe(true);
    expect(isBrainMetadataFile('X.METADATA.JSON')).toBe(true);
    // Documented semantics: the regex matches a literal `.metadata` name.
    expect(isBrainMetadataFile('.metadata')).toBe(true);
  });

  it('does not match ordinary names', () => {
    expect(isBrainMetadataFile('metadata.txt')).toBe(false);
    expect(isBrainMetadataFile('x.json')).toBe(false);
    expect(isBrainMetadataFile('x.md')).toBe(false);
  });
});

describe('brainHasVisibleContent', () => {
  it('implements the hide-list qualification predicate', () => {
    expect(brainHasVisibleContent([], [])).toBe(false);
    expect(brainHasVisibleContent(['a.metadata'], [])).toBe(false);
    expect(brainHasVisibleContent(['a.metadata.json'], [])).toBe(false);
    // Uploaded list is pre-filtered; this models "uploaded had only metadata".
    expect(brainHasVisibleContent([], ['a.metadata'])).toBe(false);
    expect(brainHasVisibleContent(['notes.txt'], [])).toBe(true);
    expect(brainHasVisibleContent([], ['photo.png'])).toBe(true);
    expect(brainHasVisibleContent(['a.metadata'], ['sub/doc.md'])).toBe(true);
  });
});

describe('DashboardViewProvider Brain Directory Rendering', () => {
  let provider: DashboardViewProvider;
  let mockContext: any;
  const tempDirs: string[] = [];

  const makeRoot = (): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zq-brain-'));
    tempDirs.push(dir);
    return dir;
  };

  const writeFile = (filePath: string, content = 'content'): void => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  };

  beforeEach(() => {
    const mockState: Record<string, any> = {};
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
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) fs.rmSync(dir, { recursive: true, force: true });
    }
    sinon.restore();
  });

  it('counts only visible sessions and renders both', async () => {
    const root = makeRoot();
    writeFile(path.join(root, 'session-a', 'implementation_plan.md'));
    writeFile(path.join(root, 'session-b', 'notes.txt'));

    const result = await (provider as any)._getBrainDirectoryHtml(root);

    expect(result.count).toBe(2);
    expect(result.html).toContain('session-a');
    expect(result.html).toContain('session-b');
  });

  it('hides a scratch-only brain entirely', async () => {
    const root = makeRoot();
    writeFile(path.join(root, 'scratch-only', 'scratch', 'junk.txt'));

    const result = await (provider as any)._getBrainDirectoryHtml(root);

    expect(result.html).not.toContain('scratch-only');
    expect(result.count).toBe(0);
  });

  it('hides a .system_generated-only brain entirely', async () => {
    const root = makeRoot();
    writeFile(
      path.join(root, 'sys-only', '.system_generated', 'logs', 'transcript.jsonl'),
    );

    const result = await (provider as any)._getBrainDirectoryHtml(root);

    expect(result.html).not.toContain('sys-only');
    expect(result.html).not.toContain('.system_generated');
    expect(result.count).toBe(0);
  });

  it('hides a brain whose .user_uploaded contains only metadata', async () => {
    const root = makeRoot();
    writeFile(path.join(root, 'meta-only', '.user_uploaded', 'a.metadata.json'));

    const result = await (provider as any)._getBrainDirectoryHtml(root);

    expect(result.html).not.toContain('meta-only');
    expect(result.count).toBe(0);
  });

  it('qualifies a brain with an arbitrary legacy direct file', async () => {
    const root = makeRoot();
    writeFile(path.join(root, 'legacy', 'notes.txt'));

    const result = await (provider as any)._getBrainDirectoryHtml(root);

    expect(result.html).toContain('notes.txt');
    expect(result.count).toBe(1);
  });

  it('renders nested .user_uploaded/sub/file.md', async () => {
    const root = makeRoot();
    writeFile(path.join(root, 'nested', '.user_uploaded', 'sub', 'file.md'));

    const result = await (provider as any)._getBrainDirectoryHtml(root);

    expect(result.html).toContain('file.md');
    expect(result.html).toContain('brain-subfolder');
    expect(result.count).toBe(1);
  });

  it('globally excludes .system_generated, scratch, and metadata', async () => {
    const root = makeRoot();
    const session = path.join(root, 'rich');
    writeFile(path.join(session, 'implementation_plan.md'));
    writeFile(path.join(session, 'notes.metadata'));
    writeFile(path.join(session, 'scratch', 'junk.txt'));
    writeFile(
      path.join(session, '.system_generated', 'logs', 'transcript.jsonl'),
    );
    writeFile(path.join(session, '.user_uploaded', 'photo.png'));
    writeFile(path.join(session, '.user_uploaded', 'doc.metadata.json'));

    const result = await (provider as any)._getBrainDirectoryHtml(root);

    expect(result.html).not.toContain('.system_generated');
    expect(result.html).not.toContain('scratch');
    expect(result.html).not.toContain('.metadata');
  });

  it('renders root standalone files but not root metadata files', async () => {
    const root = makeRoot();
    writeFile(path.join(root, 'readme.md'));
    writeFile(path.join(root, 'config.metadata'));

    const result = await (provider as any)._getBrainDirectoryHtml(root);

    expect(result.html).toContain('readme.md');
    expect(result.html).toContain('brain-file standalone');
    expect(result.html).not.toContain('config.metadata');
  });

  it('shows the empty-directory state when nothing is visible', async () => {
    const root = makeRoot();

    const result = await (provider as any)._getBrainDirectoryHtml(root);

    expect(result.html).toContain('Empty brain directory');
    expect(result.count).toBe(0);
  });

  it('shows N steps when the trajectory step count is known', async () => {
    const root = makeRoot();
    writeFile(path.join(root, 'session-steps', 'notes.txt'));
    (provider as any)._trajectories = {
      'session-steps': { summary: 'T', stepCount: 7 },
    };

    const result = await (provider as any)._getBrainDirectoryHtml(root);

    expect(result.html).toContain('7 steps');
  });

  it('shows a blank step badge when no trajectory is known', async () => {
    const root = makeRoot();
    writeFile(path.join(root, 'session-blank', 'notes.txt'));

    const result = await (provider as any)._getBrainDirectoryHtml(root);

    expect(result.html).toContain('notes.txt');
    expect(result.html).not.toMatch(/\d+\s+steps/);
  });
});

