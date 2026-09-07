import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { StatusBarManager } from '../../ui/statusBarManager';
import { UserStatus } from '../../types';

describe('StatusBarManager Tests', () => {
  let statusBarManager: StatusBarManager;
  let context: any;

  beforeEach(() => {
    context = {
      subscriptions: [],
      extensionPath: '/test/path'
    };
    statusBarManager = new StatusBarManager(context as vscode.ExtensionContext);
  });

  afterEach(() => {
    sinon.restore();
    statusBarManager.dispose();
  });

  const mockStatus: UserStatus = {
    email: 'test@example.com',
    tier: 'PRO',
    modelConfigs: [
      { label: 'Gemini 1.5 Pro (High)', quotaInfo: { remainingFraction: 0.8, resetTime: '2026-09-07T18:00:00Z' } },
      { label: 'Gemini 3 Flash', quotaInfo: { remainingFraction: 0.9, resetTime: '2026-09-07T18:00:00Z' } },
      { label: 'Claude Opus 4.6', quotaInfo: { remainingFraction: 0.7, resetTime: '2026-09-07T18:00:00Z' } }
    ],
    promptCredits: 100,
    availablePromptCredits: 100,
    flowCredits: 100,
    availableFlowCredits: 100
  };

  it('displays grouped Gemini and Claude pools when all are enabled in modelPicker', () => {
    sinon.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key: string) => {
        if (key === 'modelPicker') {
          return { geminiPro: true, geminiFlash: true, claude: true, gptOss: true };
        }
        return undefined;
      }
    } as any);

    statusBarManager.update(mockStatus);
    const text = (statusBarManager as any).statusBarItem.text;
    expect(text).toContain('Gemini 80%');
    expect(text).toContain('Claude 70%');
    expect(text).not.toContain('Pro 80%');
    expect(text).not.toContain('Flash 90%');
  });

  it('hides specific models and adjusts group labels when customized in modelPicker', () => {
    sinon.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key: string) => {
        if (key === 'modelPicker') {
          return { geminiPro: false, geminiFlash: true, claude: false, gptOss: false };
        }
        return undefined;
      }
    } as any);

    statusBarManager.update(mockStatus);
    const text = (statusBarManager as any).statusBarItem.text;
    expect(text).not.toContain('Gemini');
    expect(text).toContain('Flash 90%');
    expect(text).not.toContain('Claude');
  });

  it('displays fallback text when all models are disabled in modelPicker', () => {
    sinon.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key: string) => {
        if (key === 'modelPicker') {
          return { geminiPro: false, geminiFlash: false, claude: false, gptOss: false };
        }
        return undefined;
      }
    } as any);

    statusBarManager.update(mockStatus);
    const text = (statusBarManager as any).statusBarItem.text;
    expect(text).toBe('$(sparkle) ZeroQuota');
  });

  it('correctly matches modern Antigravity model variants and groups them cleanly', () => {
    sinon.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key: string) => {
        if (key === 'modelPicker') {
          return { geminiPro: true, geminiFlash: true, claude: true, gptOss: true };
        }
        return undefined;
      }
    } as any);

    const modernStatus: UserStatus = {
      name: 'Test Developer',
      email: 'test@example.com',
      tier: 'Google AI Pro',
      profilePictureUrl: 'data:image/jpeg;base64,mock',
      modelConfigs: [
        { label: 'Gemini 3.1 Pro (High)', quotaInfo: { remainingFraction: 0.85, resetTime: '2026-09-07T18:00:00Z' } },
        { label: 'Gemini 3.8 Flash (High)', quotaInfo: { remainingFraction: 0.65, resetTime: '2026-09-07T18:00:00Z' } },
        { label: 'Claude Sonnet 4.6 (Thinking)', quotaInfo: { remainingFraction: 0.95, resetTime: '2026-09-07T18:00:00Z' } },
        { label: 'GPT-OSS 120B (Medium)', quotaInfo: { remainingFraction: 0.50, resetTime: '2026-09-07T18:00:00Z' } }
      ],
      promptCredits: 50000,
      availablePromptCredits: 500,
      flowCredits: 150000,
      availableFlowCredits: 100
    };

    statusBarManager.update(modernStatus);
    const text = (statusBarManager as any).statusBarItem.text;
    expect(text).toContain('Gemini 85%');
    expect(text).toContain('Claude 95%');
  });

  it('displays GPT label when Claude is disabled and GPT is enabled in modelPicker', () => {
    sinon.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key: string) => {
        if (key === 'modelPicker') {
          return { geminiPro: false, geminiFlash: false, claude: false, gptOss: true };
        }
        return undefined;
      }
    } as any);

    const gptStatus: UserStatus = {
      email: 'test@example.com',
      tier: 'PRO',
      modelConfigs: [
        { label: 'GPT-OSS 120B (Medium)', quotaInfo: { remainingFraction: 0.50, resetTime: '2026-09-07T18:00:00Z' } }
      ],
      promptCredits: 100,
      availablePromptCredits: 100,
      flowCredits: 100,
      availableFlowCredits: 100
    };

    statusBarManager.update(gptStatus);
    const text = (statusBarManager as any).statusBarItem.text;
    expect(text).toContain('GPT 50%');
    expect(text).not.toContain('Claude');
  });

  it('displays offline status when userStatus is null', () => {
    statusBarManager.update(null);
    const item = (statusBarManager as any).statusBarItem;
    expect(item.text).toBe('$(circle-slash) Offline');
    expect(item.backgroundColor).toBeDefined();
  });

  it('formats reset times accurately across all ranges and handles invalid inputs', () => {
    const formatResetTime = (statusBarManager as any).formatResetTime.bind(statusBarManager);

    // Missing
    expect(formatResetTime(undefined)).toBe('N/A');
    expect(formatResetTime('invalid-date')).toBe('N/A');

    // Already passed or 0
    const past = new Date(Date.now() - 10000).toISOString();
    expect(formatResetTime(past)).toBe('Ready');

    // Over 1 hour
    const future2h = new Date(Date.now() + 2 * 3600000 + 15 * 60000).toISOString();
    expect(formatResetTime(future2h)).toMatch(/2h\s*1[45]m/);

    // Under 1 hour
    const future25m = new Date(Date.now() + 25 * 60000).toISOString();
    expect(formatResetTime(future25m)).toMatch(/2[45]m/);
  });

  it('generates rich tooltip with brand logo, account details, and refresh action', () => {
    statusBarManager.update(mockStatus);
    const tooltip = (statusBarManager as any).statusBarItem.tooltip;
    expect(tooltip).toBeDefined();
    expect(tooltip.value).toContain('ZEROQUOTA');
    expect(tooltip.value).toContain('test@example.com');
    expect(tooltip.value).toContain('PRO');
    expect(tooltip.value).toContain('command:zeroquota.refresh');
  });

  it('disposes underlying status bar item on dispose', () => {
    const item = (statusBarManager as any).statusBarItem;
    const disposeSpy = vi.spyOn(item, 'dispose');
    statusBarManager.dispose();
    expect(disposeSpy).toHaveBeenCalled();
  });
});

