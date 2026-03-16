import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { Orchestrator } from '../../core/orchestrator';
import { SidecarService } from '../../services/sidecarService';
import { StatusBarManager } from '../../ui/statusBarManager';
import { DashboardViewProvider } from '../../ui/dashboardViewProvider';
import type { UserStatus } from '../../types';

suite('Orchestrator Tests', () => {
  let orchestrator: Orchestrator;
  let context: any;
  let sidecarStub: sinon.SinonStubbedInstance<SidecarService>;
  let statusBarStub: sinon.SinonStubbedInstance<StatusBarManager>;
  let dashboardStub: sinon.SinonStubbedInstance<DashboardViewProvider>;
  let clock: sinon.SinonFakeTimers;

  setup(() => {
    context = { subscriptions: [] };
    sidecarStub = sinon.createStubInstance(SidecarService);
    statusBarStub = sinon.createStubInstance(StatusBarManager);
    dashboardStub = sinon.createStubInstance(DashboardViewProvider);
    sinon.stub(vscode.extensions, 'getExtension').returns({ exports: { orchestrator: { sidecar: sidecarStub, statusBar: statusBarStub, dashboard: dashboardStub } } } as any);
    clock = sinon.useFakeTimers();
    orchestrator = new Orchestrator(context as vscode.ExtensionContext);
  });

  teardown(() => {
    sinon.restore();
    clock.restore();
  });

  test('refresh null status early return', async () => {
    sidecarStub.fetchUserStatus.resolves(null as any);
    await orchestrator['refresh']();
    assert.ok(true); // No crash
    sinon.assert.notCalled(statusBarStub.update);
  });

  test('refresh online status updates UI', async () => {
    const status: UserStatus = {
      email: 'test@example.com',
      tier: 'N/A',
      modelConfigs: [{ label: 'claude-sonnet-4-6', quotaInfo: { remainingFraction: 0.5 } }],
      promptCredits: 0,
      availablePromptCredits: 0,
      flowCredits: 0,
      availableFlowCredits: 0
    };
    sidecarStub.fetchUserStatus.resolves(status);
    await orchestrator['refresh']();
    sinon.assert.calledWith(statusBarStub.update, status);
    sinon.assert.calledWith(dashboardStub.update, status);
  });

  test('detect reset (prev <1 → 1.0)', async () => {
    sinon.stub(vscode.workspace, 'getConfiguration').returns({ get: sinon.stub().returns(60) } as any);
    const notifyStub = sinon.stub(vscode.window, 'showInformationMessage');
    const statusReset: UserStatus = {
      email: 'test@example.com',
      tier: 'N/A',
      modelConfigs: [{ label: 'claude-sonnet-4-6', quotaInfo: { remainingFraction: 1.0 } }],
      promptCredits: 1000,
      availablePromptCredits: 1000,
      flowCredits: 0,
      availableFlowCredits: 0
    };
    sidecarStub.fetchUserStatus.resolves(statusReset);
    await orchestrator['refresh']();
    clock.tick(1000);
    sinon.assert.calledWith(notifyStub, sinon.match('Your ZeroQuota models have been fully reset!'));
  });
});