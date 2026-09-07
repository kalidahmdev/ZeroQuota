import { describe, it, expect } from 'vitest';
import * as vscode from 'vscode';
import { getQuotaColor, getQuotaEmoji, getThemeColor } from '../../ui/utils';

describe('Utils Tests', () => {
  describe('getQuotaColor', () => {
    it('returns red for quota <= 20%', () => {
      expect(getQuotaColor(0)).toBe('#f87171');
      expect(getQuotaColor(0.2)).toBe('#f87171');
    });

    it('returns yellow for quota 21-60%', () => {
      expect(getQuotaColor(0.21)).toBe('#fbbf24');
      expect(getQuotaColor(0.6)).toBe('#fbbf24');
    });

    it('returns neon green for quota > 60%', () => {
      expect(getQuotaColor(0.61)).toBe('#ccff00');
      expect(getQuotaColor(1.0)).toBe('#ccff00');
    });
  });

  describe('getQuotaEmoji', () => {
    it('returns red square for quota <= 20%', () => {
      expect(getQuotaEmoji(0.1)).toBe('🟥');
    });

    it('returns yellow square for quota 21-60%', () => {
      expect(getQuotaEmoji(0.4)).toBe('🟨');
    });

    it('returns green square for quota > 60%', () => {
      expect(getQuotaEmoji(0.8)).toBe('🟩');
    });
  });

  describe('getThemeColor', () => {
    it('returns black for brand neon in light theme', () => {
      (vscode.window as any).activeColorTheme = { kind: vscode.ColorThemeKind.Light };
      expect(getThemeColor('#ccff00')).toBe('#000000');
      expect(getThemeColor('Premium Neon')).toBe('#000000');
    });

    it('preserves neon green in dark theme', () => {
      (vscode.window as any).activeColorTheme = { kind: vscode.ColorThemeKind.Dark };
      expect(getThemeColor('#ccff00')).toBe('#ccff00');
    });

    it('preserves non-neon colors in light theme', () => {
      (vscode.window as any).activeColorTheme = { kind: vscode.ColorThemeKind.Light };
      expect(getThemeColor('#f87171')).toBe('#f87171');
      expect(getThemeColor('#fbbf24')).toBe('#fbbf24');
    });
  });
});