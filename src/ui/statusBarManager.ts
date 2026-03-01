import * as vscode from "vscode";
import { UserStatus } from "../services/sidecarService";

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    this.statusBarItem.command = "zeroquota.refresh";
  }

  update(status: UserStatus | null, autoAccept: boolean) {
    if (!status) {
      this.statusBarItem.text = "$(circle-slash) ZeroQuota: Offline";
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.errorBackground",
      );
      this.statusBarItem.show();
      return;
    }

    // Find the "most exhausted" model to show in status bar
    const relevantModels = status.modelConfigs.filter((m) => m.quotaInfo);
    const criticalModel = relevantModels.sort(
      (a, b) =>
        (a.quotaInfo?.remainingFraction || 1) -
        (b.quotaInfo?.remainingFraction || 1),
    )[0];

    const fraction = criticalModel?.quotaInfo?.remainingFraction ?? 1;
    const percentage = Math.round(fraction * 100);
    const color = this.getQuotaColor(fraction);
    const icon = autoAccept ? "$(rocket)" : "$(hubot)";

    const resetTime = this.formatResetTime(criticalModel?.quotaInfo?.resetTime);
    const timeStr = fraction < 0.4 ? ` (${resetTime})` : "";

    this.statusBarItem.text = `${icon} ZeroQuota: ${percentage}%${timeStr}`;
    this.statusBarItem.color = color;
    this.statusBarItem.tooltip = this.createTooltip(status, autoAccept);
    this.statusBarItem.show();
  }

  private getQuotaColor(fraction: number): string {
    if (fraction >= 0.4) return "#4ecb71"; // Green
    if (fraction >= 0.2) return "#f1c40f"; // Yellow
    return "#e74c3c"; // Red
  }

  private createTooltip(
    status: UserStatus,
    autoAccept: boolean,
  ): vscode.MarkdownString {
    const md = new vscode.MarkdownString(`### 🤖 ZeroQuota: Active Models\n\n`);
    md.appendMarkdown(`**User:** ${status.email} (${status.tier})\n\n`);
    md.appendMarkdown(`| Model | Quota | Reset |\n`);
    md.appendMarkdown(`| :--- | :--- | :--- |\n`);

    for (const m of status.modelConfigs) {
      if (!m.quotaInfo) continue;
      const pct = Math.round(m.quotaInfo.remainingFraction * 100);
      const reset = this.formatResetTime(m.quotaInfo.resetTime);
      const indicator =
        m.quotaInfo.remainingFraction >= 0.4
          ? "🟢"
          : m.quotaInfo.remainingFraction >= 0.2
            ? "🟡"
            : "🔴";
      md.appendMarkdown(
        `| ${m.label} | ${indicator} **${pct}%** | ${reset} |\n`,
      );
    }

    md.appendMarkdown(`\n---\n`);
    md.appendMarkdown(
      `**Hands-free Mode:** ${autoAccept ? "🚀 Enabled" : "📁 Disabled"}`,
    );
    md.isTrusted = true;
    return md;
  }

  private formatResetTime(resetTimeStr?: string): string {
    if (!resetTimeStr) return "N/A";
    try {
      const resetDate = new Date(resetTimeStr);
      const now = new Date();
      const diffMs = resetDate.getTime() - now.getTime();

      if (diffMs <= 0) return "Ready";

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 0) return `${hours}h ${minutes}m`;
      return `${minutes}m`;
    } catch {
      return "N/A";
    }
  }

  dispose() {
    this.statusBarItem.dispose();
  }
}
