import { vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import * as sinon from 'sinon';

// Define Mocha global hooks for Vitest compatibility
(globalThis as any).setup = beforeEach;
(globalThis as any).teardown = afterEach;
(globalThis as any).suiteSetup = beforeAll;
(globalThis as any).suiteTeardown = afterAll;

// Mock the VS Code module globally for tests running in Node
vi.mock('vscode', () => {
  const ColorThemeKind = {
    Light: 1,
    Dark: 2,
    HighContrast: 3,
    HighContrastLight: 4
  };

  const StatusBarAlignment = {
    Left: 1,
    Right: 2
  };

  const ExtensionContext = {};

  class MarkdownString {
    isTrusted = false;
    supportHtml = false;
    value = "";
    constructor(value = "", supportHtml = false) {
      this.value = value;
      this.supportHtml = supportHtml;
    }
    appendMarkdown(val: string) {
      this.value += val;
      return this;
    }
    appendCodeblock(val: string, lang?: string) {
      this.value += "\n```" + (lang || "") + "\n" + val + "\n```\n";
      return this;
    }
  }

  class ThemeColor {
    id: string;
    constructor(id: string) {
      this.id = id;
    }
  }

  const mockVSCode = {
    ColorThemeKind,
    StatusBarAlignment,
    ExtensionContext,
    MarkdownString,
    ThemeColor,
    window: {
      registerWebviewViewProvider: vi.fn(),
      showInformationMessage: vi.fn(),
      showWarningMessage: vi.fn(),
      showErrorMessage: vi.fn(),
      activeColorTheme: { kind: 2 },
      onDidChangeActiveColorTheme: vi.fn(() => ({ dispose: vi.fn() })),
      createStatusBarItem: vi.fn(() => ({
        show: vi.fn(),
        hide: vi.fn(),
        dispose: vi.fn(),
        text: "",
        tooltip: "",
        command: "",
        backgroundColor: undefined
      })),
    },
    workspace: {
      workspaceFolders: undefined as any,
      getConfiguration: vi.fn(() => ({
        get: vi.fn((key: string, def: any) => {
          if (key === "modelPicker") return { geminiPro: true, geminiFlash: true, claude: true, gptOss: true };
          if (key === "autoUpdateInterval") return 60;
          return def;
        }),
        update: vi.fn()
      })),
      onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
    },
    commands: {
      registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
      executeCommand: vi.fn(),
    },
    Uri: {
      file: vi.fn((pathStr: string) => ({ fsPath: pathStr, path: pathStr })),
      joinPath: vi.fn((base: any, ...parts: string[]) => ({
        fsPath: [base.fsPath, ...parts].join('/'),
        path: [base.fsPath, ...parts].join('/')
      })),
    },
    env: {
      appName: "VS Code",
      openExternal: vi.fn(),
    },
    ConfigurationTarget: {
      Global: 1,
      Workspace: 2,
      WorkspaceFolder: 3
    },
    extensions: {
      getExtension: vi.fn(() => ({
        exports: {
          orchestrator: {
            sidecar: {},
            statusBar: {},
            dashboard: {}
          }
        }
      }))
    }
  };

  return new Proxy(mockVSCode, {
    has() { return true; },
    get(target, prop) {
      if (prop === 'then') return undefined;
      return (target as any)[prop];
    }
  });
});

// Mock child_process to be a mutable object for Sinon stubbing, using a permissive proxy to bypass Vitest's strict symbol checks
vi.mock('child_process', () => {
  const customPromisifySymbol = Symbol.for('nodejs.util.promisify.custom');
  const execMock = (_cmd: any, options: any, callback: any) => {
    const cb = typeof options === 'function' ? options : callback;
    if (cb) cb(null, '', '');
    return { pid: 0, kill: () => {} };
  };
  (execMock as any)[customPromisifySymbol] = () => {
    return Promise.resolve({ stdout: '', stderr: '' });
  };

  const mockObj = {
    exec: execMock
  };
  return new Proxy(mockObj, {
    has() { return true; },
    get(target, prop) {
      if (prop === 'then') return undefined;
      return (target as any)[prop];
    },
    set(target, prop, value) {
      (target as any)[prop] = value;
      return true;
    }
  });
});

// Mock axios to be a mutable object for Sinon stubbing, using a permissive proxy to bypass Vitest's strict symbol checks
vi.mock('axios', () => {
  const mockAxios = {
    post: () => Promise.resolve({ data: {} }),
    get: () => Promise.resolve({ data: "" })
  };
  const mockAxiosModule = {
    default: mockAxios,
    ...mockAxios
  };
  return new Proxy(mockAxiosModule, {
    has() { return true; },
    get(target, prop) {
      if (prop === 'then') return undefined;
      return (target as any)[prop];
    },
    set(target, prop, value) {
      (target as any)[prop] = value;
      if (prop === 'post') {
        mockAxios.post = value;
        (mockAxiosModule as any).post = value;
      }
      if (prop === 'get') {
        mockAxios.get = value;
        (mockAxiosModule as any).get = value;
      }
      return true;
    }
  });
});

// Mock fs to be a mutable object for Sinon/Vitest stubbing in ESM
vi.mock('fs', async (importOriginal) => {
  const actualFs = await importOriginal<typeof import('fs')>();
  const mockFs: any = { ...actualFs, default: actualFs };
  return new Proxy(mockFs, {
    has() { return true; },
    get(target, prop) {
      if (prop === 'then') return undefined;
      if (prop in target) return target[prop];
      return (actualFs as any)[prop];
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    }
  });
});

beforeEach(() => {
  // Global setup if needed
});

afterEach(() => {
  sinon.restore();
  vi.restoreAllMocks();
});

