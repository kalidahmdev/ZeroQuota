import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { getQuotaColor, getQuotaEmoji, getThemeColor } from '../../ui/utils';

suite('Utils Tests', () => {
  teardown(() => sinon.restore());

  test('getQuotaColor thresholds', () => {
    assert.strictEqual(getQuotaColor(0), '#f87171');
    assert.strictEqual(getQuotaColor(0.1), '#f87171');
    assert.strictEqual(getQuotaColor(0.3), '#fbbf24');
    assert.strictEqual(getQuotaColor(0.7), '#ccff00');
  });

  test('getQuotaEmoji thresholds', () => {
    assert.strictEqual(getQuotaEmoji(0.1), '🟥');
    assert.strictEqual(getQuotaEmoji(0.3), '🟨');
    assert.strictEqual(getQuotaEmoji(0.7), '🟩');
  });

  test('getThemeColor light/dark', () => {
    sinon.stub(vscode.window, 'activeColorTheme').value({ kind: vscode.ColorThemeKind.Light });
    assert.strictEqual(getThemeColor('#ccff00'), '#000000');
    sinon.stub(vscode.window, 'activeColorTheme').value({ kind: vscode.ColorThemeKind.Dark });
    assert.strictEqual(getThemeColor('#ccff00'), '#ccff00');
  });
});