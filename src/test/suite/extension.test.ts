import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { activate, deactivate } from '../../extension';

suite('Extension Tests', () => {
  let context: any;

  setup(() => {
    context = {
      subscriptions: [],
      extensionUri: { fsPath: '/test/path' },
      extensionPath: '/test/path',
      globalState: {
        get: sinon.stub().returns(undefined),
        update: sinon.stub().resolves()
      }
    };
  });

  teardown(() => {
    deactivate();
    sinon.restore();
  });

  test('extension activates and registers commands into subscriptions', async () => {
    const registerCommandSpy = sinon.spy(vscode.commands, 'registerCommand');
    await activate(context as vscode.ExtensionContext);

    assert.ok(context.subscriptions.length > 0, 'Subscriptions should not be empty');
    assert.ok(registerCommandSpy.calledWith('zeroquota.refresh'));
    assert.ok(registerCommandSpy.calledWith('zeroquota.openBrain'));
    assert.ok(registerCommandSpy.calledWith('zeroquota.openMcpConfig'));
    assert.ok(registerCommandSpy.calledWith('zeroquota.openRules'));
    assert.ok(registerCommandSpy.calledWith('zeroquota.openSkills'));
    assert.ok(registerCommandSpy.calledWith('zeroquota.openWorkflows'));
    assert.ok(registerCommandSpy.calledWith('zeroquota.statusBarAction'));
    assert.ok(registerCommandSpy.calledWith('zeroquota.reload'));
  });

  test('extension deactivates without throwing', () => {
    assert.doesNotThrow(() => {
      deactivate();
    });
  });
});