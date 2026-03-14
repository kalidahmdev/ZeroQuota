/**
 * ZeroQuota - Antigravity IDE Extension
 * Copyright (c) 2026 kalidahmdev
 * Licensed under the MIT License
 */

/**
 * Returns the hex color code for a given quota fraction.
 * Red: 0-20% (<= 0.2)
 * Yellow: 21-60% (<= 0.6)
 * Green: 61-100% (> 0.6)
 */
export function getQuotaColor(frac: number): string {
  if (frac <= 0.2) return "#f87171"; // Red
  if (frac <= 0.6) return "#fbbf24"; // Yellow
  return "#ccff00"; // Green (Premium Neon)
}

/**
 * Returns the emoji representation for a given quota fraction.
 * Consistent with getQuotaColor thresholds.
 */
export function getQuotaEmoji(frac: number): string {
  if (frac <= 0.2) return "🟥";
  if (frac <= 0.6) return "🟨";
  return "🟩";
}
