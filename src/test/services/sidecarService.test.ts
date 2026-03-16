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

  it('returns null if server is not found', async () => {
    execStub.yields(null, '', '');
    const serverInfo = await (service as any).discoverServer();
    expect(serverInfo).toBeNull();
  });
});
