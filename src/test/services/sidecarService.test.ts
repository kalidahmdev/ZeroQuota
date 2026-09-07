import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as sinon from 'sinon';
import * as child_process from 'child_process';
import { SidecarService } from '../../services/sidecarService';

describe('SidecarService Tests', () => {
  let service: SidecarService;
  let execStub: sinon.SinonStub;

  beforeEach(() => {
    service = new SidecarService();
    // Use sinon for complex callback-based mocking of exec
    execStub = sinon.stub(child_process, 'exec');
  });

  it('discovers server on Windows using powershell', async () => {
    // Mock Windows platform
    vi.stubGlobal('process', { ...process, platform: 'win32' });
    
    const mockOutput = JSON.stringify({ ProcessId: 1234, CommandLine: '--csrf_token abc-123 --extension_server_port 8080' });
    execStub.callsFake((cmd, _options, callback) => {
      if (cmd.includes('Get-WmiObject')) {
        callback(null, mockOutput, '');
      }
      return {};
    });

    const serverInfo = await (service as any).discoverServer();
    expect(serverInfo).not.toBeNull();
    expect(serverInfo.pid).toBe('1234');
    expect(serverInfo.token).toBe('abc-123');
    expect(serverInfo.port).toBe('8080');
    
    vi.unstubAllGlobals();
  });

  it('discovers server on Unix using ps aux', async () => {
    vi.stubGlobal('process', { ...process, platform: 'linux' });
    
    const mockPsOutput = 'user 1234 0.0 0.0 ... language_server --csrf_token xyz-789 --extension_server_port 9090\n';
    execStub.callsFake((cmd, _options, callback) => {
      if (cmd === 'ps aux') {
        callback(null, mockPsOutput, '');
      }
      return {};
    });

    const serverInfo = await (service as any).discoverServer();
    expect(serverInfo).not.toBeNull();
    expect(serverInfo.pid).toBe('1234');
    expect(serverInfo.token).toBe('xyz-789');
    
    vi.unstubAllGlobals();
  });

  it('discovers server in VS Code agy hub mode', async () => {
    vi.stubGlobal('process', { ...process, platform: 'win32' });

    const mockOutput = JSON.stringify({
      ProcessId: 5678,
      CommandLine: 'C:\\Users\\test\\.gemini\\bin\\agy.exe --hub --hub-port 60765 --app_data_dir antigravity'
    });
    execStub.callsFake((cmd, _options, callback) => {
      if (cmd.includes('Get-WmiObject')) {
        callback(null, mockOutput, '');
      }
      return {};
    });

    const axios = (await import('axios')).default;
    const axiosStub = sinon.stub(axios, 'get').resolves({
      data: '<script>window.__APP_CONFIG__ = {"productName":"antigravity","csrfToken":"hub-token-456"};</script>'
    } as any);

    const serverInfo = await (service as any).discoverServer();
    expect(serverInfo).not.toBeNull();
    expect(serverInfo.pid).toBe('5678');
    expect(serverInfo.token).toBe('hub-token-456');
    expect(serverInfo.port).toBe('60765');

    axiosStub.restore();
    vi.unstubAllGlobals();
  });

  it('returns null if server is not found', async () => {
    execStub.yields(null, '', '');
    const serverInfo = await (service as any).discoverServer();
    expect(serverInfo).toBeNull();
  });

  it('fetchTrajectories returns parsed trajectory summaries when available', async () => {
    const axios = (await import('axios')).default;
    const axiosPostStub = sinon.stub(axios, 'post').resolves({
      data: {
        trajectorySummaries: {
          'session-123': {
            summary: 'Test Session Title',
            stepCount: 42,
            lastModifiedTime: '2026-09-07T12:00:00Z'
          }
        }
      }
    } as any);

    (service as any).lastWorkingServer = {
      port: '8080',
      token: 'tok-123',
      protocol: 'http'
    };

    const trajectories = await service.fetchTrajectories();
    expect(trajectories).not.toBeNull();
    expect(trajectories!['session-123']).toBeDefined();
    expect(trajectories!['session-123'].summary).toBe('Test Session Title');
    expect(trajectories!['session-123'].stepCount).toBe(42);

    axiosPostStub.restore();
  });

  it('fetchTrajectories returns null on error', async () => {
    const axios = (await import('axios')).default;
    const axiosPostStub = sinon.stub(axios, 'post').rejects(new Error('Network error'));

    (service as any).lastWorkingServer = {
      port: '8080',
      token: 'tok-123',
      protocol: 'http'
    };

    const trajectories = await service.fetchTrajectories();
    expect(trajectories).toBeNull();

    axiosPostStub.restore();
  });

  it('fetchUserStatus extracts activeModel and activeModelLabel when defaultOverrideModelConfig is present', async () => {
    const axios = (await import('axios')).default;
    const axiosPostStub = sinon.stub(axios, 'post').resolves({
      data: {
        userStatus: {
          email: 'test@example.com',
          cascadeModelConfigData: {
            clientModelConfigs: [
              { label: 'Gemini 3.8 Flash (High)', modelOrAlias: { model: 'MODEL_M318' }, quotaInfo: { remainingFraction: 0.5 } },
              { label: 'Gemini 3.1 Pro (High)', modelOrAlias: { model: 'MODEL_M16' }, quotaInfo: { remainingFraction: 0.5 } }
            ],
            defaultOverrideModelConfig: {
              modelOrAlias: { model: 'MODEL_M318' }
            }
          }
        }
      }
    } as any);

    (service as any).discoverServer = sinon.stub().resolves({ pid: '123', token: 'tok' });
    (service as any).getListeningPorts = sinon.stub().resolves(['8080']);

    const status = await service.fetchUserStatus();
    expect(status).not.toBeNull();
    expect(status?.activeModel).toBe('MODEL_M318');
    expect(status?.activeModelLabel).toBe('Gemini 3.8 Flash (High)');

    axiosPostStub.restore();
  });

  it('fetchStatusFromPort falls back to https when http fails', async () => {
    const axios = (await import('axios')).default;
    const axiosPostStub = sinon.stub(axios, 'post');

    // First call (http) rejects
    axiosPostStub.onFirstCall().rejects(new Error('Connection refused / SSL required'));
    // Second call (https) resolves
    axiosPostStub.onSecondCall().resolves({
      data: {
        userStatus: {
          email: 'secure@example.com',
          modelConfigs: []
        }
      }
    } as any);

    const result = await (service as any).fetchStatusFromPort('8443', 'test-token');
    expect(result).not.toBeNull();
    expect(result.protocol).toBe('https');
    expect(result.data.userStatus.email).toBe('secure@example.com');

    axiosPostStub.restore();
  });

  it('discovers server in VS Code agy hub mode on Unix', async () => {
    vi.stubGlobal('process', { ...process, platform: 'linux' });

    const mockPsOutput = 'user 9876 0.0 0.0 1000 2000 pts/0 S 12:00 0:00 agy --hub --hub-port 54321 --app_data_dir antigravity\n';
    execStub.callsFake((cmd, _options, callback) => {
      if (cmd === 'ps aux') {
        callback(null, mockPsOutput, '');
      }
      return {};
    });

    const axios = (await import('axios')).default;
    const axiosStub = sinon.stub(axios, 'get').resolves({
      data: '<html><script>window.__APP_CONFIG__ = {"csrfToken":"unix-hub-token-999"};</script></html>'
    } as any);

    const serverInfo = await (service as any).discoverServer();
    expect(serverInfo).not.toBeNull();
    expect(serverInfo.pid).toBe('9876');
    expect(serverInfo.token).toBe('unix-hub-token-999');
    expect(serverInfo.port).toBe('54321');

    axiosStub.restore();
    vi.unstubAllGlobals();
  });

  it('extracts listening port dynamically when --hub-port is omitted', async () => {
    vi.stubGlobal('process', { ...process, platform: 'win32' });

    const mockOutput = JSON.stringify({
      ProcessId: 7777,
      CommandLine: 'C:\\bin\\agy.exe --hub'
    });
    execStub.callsFake((cmd, _options, callback) => {
      if (cmd.includes('Get-WmiObject')) {
        callback(null, mockOutput, '');
      } else if (cmd === 'netstat -ano') {
        callback(null, 'TCP    127.0.0.1:49152         0.0.0.0:0              LISTENING       7777\n', '');
      }
      return {};
    });

    const axios = (await import('axios')).default;
    const axiosStub = sinon.stub(axios, 'get').resolves({
      data: '{"csrfToken":"dyn-port-token"}'
    } as any);

    const serverInfo = await (service as any).discoverServer();
    expect(serverInfo).not.toBeNull();
    expect(serverInfo.pid).toBe('7777');
    expect(serverInfo.port).toBe('49152');
    expect(serverInfo.token).toBe('dyn-port-token');

    axiosStub.restore();
    vi.unstubAllGlobals();
  });

  it('handles hub token extraction failure gracefully', async () => {
    const axios = (await import('axios')).default;
    const axiosStub = sinon.stub(axios, 'get').rejects(new Error('Network error'));

    const token = await (service as any).fetchCsrfTokenFromHub('9999');
    expect(token).toBeUndefined();

    axiosStub.restore();
  });

  it('falls back to status.modelConfigs when cascadeModelConfigData is missing', async () => {
    const axios = (await import('axios')).default;
    const axiosPostStub = sinon.stub(axios, 'post').resolves({
      data: {
        userStatus: {
          email: 'legacy@example.com',
          userTier: { name: 'PRO' },
          modelConfigs: [
            { label: 'Gemini 3 Pro', quotaInfo: { remainingFraction: 0.8 } }
          ],
          planStatus: {
            availablePromptCredits: 50,
            planInfo: { monthlyPromptCredits: 100 }
          }
        }
      }
    } as any);

    (service as any).discoverServer = sinon.stub().resolves({ pid: '123', token: 'tok', port: '8080' });
    (service as any).getListeningPorts = sinon.stub().resolves(['8080']);

    const status = await service.fetchUserStatus();
    expect(status).not.toBeNull();
    expect(status?.email).toBe('legacy@example.com');
    expect(status?.tier).toBe('PRO');
    expect(status?.modelConfigs.length).toBe(1);
    expect(status?.modelConfigs[0].label).toBe('Gemini 3 Pro');
    expect(status?.promptCredits).toBe(100);
    expect(status?.availablePromptCredits).toBe(50);

    axiosPostStub.restore();
  });

  it('handles process execution error in discoverServer without crashing', async () => {
    execStub.callsFake((_cmd, _options, callback) => {
      callback(new Error('Permission denied'), '', '');
      return {};
    });

    const serverInfo = await (service as any).discoverServer();
    expect(serverInfo).toBeNull();
  });
});


