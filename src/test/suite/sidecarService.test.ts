import * as assert from 'assert';
import * as sinon from 'sinon';
import * as child_process from 'child_process';
import axios from 'axios';
import { SidecarService } from '../../services/sidecarService';

suite('SidecarService Tests', () => {
  let service: SidecarService;
  let execStub: sinon.SinonStub;
  let axiosPostStub: sinon.SinonStub;
  let platformStub: sinon.SinonStub;

  setup(() => {
    service = new SidecarService();
    execStub = sinon.stub(child_process, 'exec').callsFake((_cmd: string, _options?: any, cb?: (error: any, stdout: string, stderr: string) => void) => {
      cb!(null, '', '');
      return { pid: 0, kill: sinon.stub() } as any;
    });
    axiosPostStub = sinon.stub(axios, 'post').resolves({ data: { userStatus: null } });
    platformStub = sinon.stub(process, 'platform').value('darwin');
  });

  teardown(() => sinon.restore());

  test('fetchUserStatus no server → null', async () => {
    const status = await service.fetchUserStatus();
    assert.strictEqual(status, null);
  });

  test('fetchUserStatus win discovery', async () => {
    platformStub.value('win32');
    execStub.onFirstCall().yieldsAsync(null, JSON.stringify([{ ProcessId: '1234', CommandLine: '--csrf_token=abc language_server_windows_1' }]), '');
    execStub.onSecondCall().yieldsAsync(null, 'TCP    127.0.0.1:8080         0.0.0.0:0              LISTENING       1234', '');
    axiosPostStub.resolves({ data: { userStatus: { email: 'test@example.com', tier: 'N/A', modelConfigs: [{ label: 'claude', quotaInfo: { remainingFraction: 0.5 } }], promptCredits: 0, availablePromptCredits: 0, flowCredits: 0, availableFlowCredits: 0 } } });
    const status = await service.fetchUserStatus();
    assert.strictEqual(status!.email, 'test@example.com');
  });

  test('fetchUserStatus unix discovery', async () => {
    platformStub.value('linux');
    execStub.onFirstCall().yieldsAsync(null, 'USER PID %CPU ... COMMAND\\nuser 1234 ... language_server --csrf_token=abc', '');
    execStub.onSecondCall().yieldsAsync(null, 'COMMAND PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME\\nlsof 1234 user   5u  IPv4 8080 TCP *:8080 (LISTEN)', '');
    axiosPostStub.resolves({ data: { userStatus: { email: 'test@example.com', tier: 'N/A', modelConfigs: [], promptCredits: 0, availablePromptCredits: 0, flowCredits: 0, availableFlowCredits: 0 } } });
    const status = await service.fetchUserStatus();
    assert.ok(status);
  });
});