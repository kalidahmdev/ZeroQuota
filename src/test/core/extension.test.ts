import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { activate, deactivate } from '../../extension';

describe('Extension Activation & Developer Hub Tests', () => {
  let context: any;
  let commandHandlers: Record<string, (...args: any[]) => any> = {};

  beforeEach(() => {
    commandHandlers = {};
    context = {
      subscriptions: [],
      extensionUri: { fsPath: '/test/path' },
      extensionPath: '/test/path',
      globalState: {
        get: vi.fn(),
        update: vi.fn().mockResolvedValue(undefined),
      },
    };

    sinon.stub(vscode.commands, 'registerCommand').callsFake((cmd: string, handler: (...args: any[]) => any) => {
      commandHandlers[cmd] = handler;
      return { dispose: sinon.stub() } as any;
    });
  });

  afterEach(() => {
    deactivate();
    sinon.restore();
    vi.restoreAllMocks();
  });

  it('registers all v2 Developer Hub commands upon activation', async () => {
    await activate(context);

    expect(commandHandlers['zeroquota.refresh']).toBeDefined();
    expect(commandHandlers['zeroquota.openBrain']).toBeDefined();
    expect(commandHandlers['zeroquota.openMcpConfig']).toBeDefined();
    expect(commandHandlers['zeroquota.openRules']).toBeDefined();
    expect(commandHandlers['zeroquota.openSkills']).toBeDefined();
    expect(commandHandlers['zeroquota.openWorkflows']).toBeDefined();
    expect(commandHandlers['zeroquota.statusBarAction']).toBeDefined();
    expect(commandHandlers['zeroquota.reload']).toBeDefined();
  });

  it('zeroquota.openBrain opens the Antigravity brain directory', async () => {
    await activate(context);
    const openExternalStub = sinon.stub(vscode.env, 'openExternal');

    commandHandlers['zeroquota.openBrain']();

    const expectedBrainPath = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
    expect(openExternalStub.calledOnce).toBe(true);
    const arg = openExternalStub.firstCall.args[0];
    expect(arg.fsPath).toBe(expectedBrainPath);
  });

  it('zeroquota.openMcpConfig scaffolds mcp_config.json if not present and opens it', async () => {
    await activate(context);

    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined as any);
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockReturnValue(undefined as any);
    const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');

    await commandHandlers['zeroquota.openMcpConfig']();

    const targetConfigPath = path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json');
    expect(mkdirSpy).toHaveBeenCalled();
    expect(writeSpy).toHaveBeenCalled();
    const writtenContent = writeSpy.mock.calls[0][1] as string;
    expect(writtenContent).toContain('"mcpServers": {}');
    expect(executeCommandStub.calledWith('vscode.open', sinon.match((uri: any) => uri.fsPath === targetConfigPath))).toBe(true);
  });

  it('zeroquota.openMcpConfig prefers legacy path if it already exists', async () => {
    await activate(context);

    const legacyPath = path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json');
    const globalPath = path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json');

    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      if (p === legacyPath) return true;
      if (p === globalPath) return false;
      return false;
    });

    const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
    await commandHandlers['zeroquota.openMcpConfig']();

    expect(executeCommandStub.calledWith('vscode.open', sinon.match((uri: any) => uri.fsPath === legacyPath))).toBe(true);
  });

  it('zeroquota.openRules opens workspace GEMINI.md when present', async () => {
    await activate(context);

    (vscode.workspace as any).workspaceFolders = [
      { uri: { fsPath: '/mock/workspace' } }
    ];

    const workspaceRulesPath = path.join('/mock/workspace', 'GEMINI.md');
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => p === workspaceRulesPath);

    const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
    await commandHandlers['zeroquota.openRules']();

    expect(executeCommandStub.calledWith('vscode.open', sinon.match((uri: any) => uri.fsPath === workspaceRulesPath))).toBe(true);
  });

  it('zeroquota.openRules falls back to global GEMINI.md and scaffolds template if missing', async () => {
    await activate(context);

    (vscode.workspace as any).workspaceFolders = [];
    const globalRulesPath = path.join(os.homedir(), '.gemini', 'GEMINI.md');

    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined as any);
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockReturnValue(undefined as any);
    const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');

    await commandHandlers['zeroquota.openRules']();

    expect(mkdirSpy).toHaveBeenCalled();
    expect(writeSpy).toHaveBeenCalledWith(globalRulesPath, expect.stringContaining('# Antigravity Rules'), 'utf8');
    expect(executeCommandStub.calledWith('vscode.open', sinon.match((uri: any) => uri.fsPath === globalRulesPath))).toBe(true);
  });

  it('zeroquota.openSkills opens workspace skills directory when found', async () => {
    await activate(context);

    (vscode.workspace as any).workspaceFolders = [
      { uri: { fsPath: '/mock/project' } }
    ];

    const skillsPath = path.join('/mock/project', '.agents', 'skills');
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => p === skillsPath);

    const openExternalStub = sinon.stub(vscode.env, 'openExternal');
    await commandHandlers['zeroquota.openSkills']();

    expect(openExternalStub.calledWith(sinon.match((uri: any) => uri.fsPath === skillsPath))).toBe(true);
  });

  it('zeroquota.openSkills falls back to global skills and creates directory if missing', async () => {
    await activate(context);

    (vscode.workspace as any).workspaceFolders = [];
    const globalSkills = path.join(os.homedir(), '.gemini', 'skills');

    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined as any);
    const openExternalStub = sinon.stub(vscode.env, 'openExternal');

    await commandHandlers['zeroquota.openSkills']();

    expect(mkdirSpy).toHaveBeenCalledWith(globalSkills, { recursive: true });
    expect(openExternalStub.calledWith(sinon.match((uri: any) => uri.fsPath === globalSkills))).toBe(true);
  });

  it('zeroquota.openWorkflows delegates to zeroquota.openSkills', async () => {
    await activate(context);

    const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
    await commandHandlers['zeroquota.openWorkflows']();

    expect(executeCommandStub.calledWith('zeroquota.openSkills')).toBe(true);
  });

  it('zeroquota.statusBarAction triggers refresh and focuses dashboard', async () => {
    await activate(context);

    const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
    await commandHandlers['zeroquota.statusBarAction']();

    expect(executeCommandStub.calledWith('zeroquota.refresh')).toBe(true);
    expect(executeCommandStub.calledWith('zeroquota.dashboard.focus')).toBe(true);
  });

  it('zeroquota.reload calls reloadWindow', async () => {
    await activate(context);

    const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
    commandHandlers['zeroquota.reload']();

    expect(executeCommandStub.calledWith('workbench.action.reloadWindow')).toBe(true);
  });

  it('re-polls on configuration change affecting zeroquota', async () => {
    let configChangeCallback: any;
    sinon.stub(vscode.workspace, 'onDidChangeConfiguration').callsFake((cb: any) => {
      configChangeCallback = cb;
      return { dispose: sinon.stub() } as any;
    });

    await activate(context);

    expect(configChangeCallback).toBeDefined();
    configChangeCallback({ affectsConfiguration: (section: string) => section === 'zeroquota' });
  });
});
