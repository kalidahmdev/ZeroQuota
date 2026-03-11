import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { UserStatus } from "../services/sidecarService";

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;

  constructor(private context: vscode.ExtensionContext) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    this.statusBarItem.command = "zeroquota.statusBarAction";
  }

  update(status: UserStatus | null) {
    if (!status) {
      this.statusBarItem.text = "$(circle-slash) Offline";
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.errorBackground",
      );
      this.statusBarItem.show();
      return;
    }

    const configs = status.modelConfigs;

    // Find principal models for status bar display
    const pro = configs.find((m) => m.label.includes("Pro (High)"));
    const flash = configs.find((m) => m.label.includes("Gemini 3 Flash"));
    const opus = configs.find((m) => m.label.includes("Claude Opus"));

    const parts: string[] = [];

    if (pro?.quotaInfo) {
      const pct = Math.round(pro.quotaInfo.remainingFraction * 100);
      const timer = this.formatResetTime(pro.quotaInfo.resetTime);
      parts.push(`Pro ${pct}% ${timer}`);
    }

    if (flash?.quotaInfo) {
      const pct = Math.round(flash.quotaInfo.remainingFraction * 100);
      const timer = this.formatResetTime(flash.quotaInfo.resetTime);
      parts.push(`Flash ${pct}% ${timer}`);
    }

    if (opus?.quotaInfo) {
      const timer = this.formatResetTime(opus.quotaInfo.resetTime);
      parts.push(`Claude ${timer}`);
    }

    this.statusBarItem.text = parts.join(" | ");

    // Calculate minimum fraction across all tracked models to color the status bar text
    let fractions: number[] = [];
    if (pro?.quotaInfo) fractions.push(pro.quotaInfo.remainingFraction);
    if (flash?.quotaInfo) fractions.push(flash.quotaInfo.remainingFraction);
    if (opus?.quotaInfo) fractions.push(opus.quotaInfo.remainingFraction);
    
    let minFrac = 1.0;
    if (fractions.length > 0) {
        minFrac = Math.min(...fractions);
    }

    if (minFrac < 0.1) {
        this.statusBarItem.color = new vscode.ThemeColor("errorForeground");
    } else if (minFrac < 0.4) {
        this.statusBarItem.color = new vscode.ThemeColor("charts.yellow");
    } else {
        this.statusBarItem.color = undefined;
    }

    this.statusBarItem.tooltip = this.createTooltip(status);
    this.statusBarItem.show();
  }

  private createTooltip(status: UserStatus): vscode.MarkdownString {
    const md = new vscode.MarkdownString("", true);
    md.isTrusted = true;
    md.supportHtml = true;
    // Root container with much wider fixed width and added padding for height
    md.appendMarkdown(`<div style="width: 500px; padding: 16px 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">`);

    // Redesigned Premium Header with Logo
    md.appendMarkdown(`<div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.05) 100%); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">`);
    
    // Logo and Title Row
    const appLogo = this.getAppLogo();
    md.appendMarkdown(`<table style="width: 100%; border-collapse: collapse;">`);
    md.appendMarkdown(`<tr>`);
    md.appendMarkdown(`<td style="width: 32px; vertical-align: middle;">`);
    if (appLogo) {
      md.appendMarkdown(`<img src="${appLogo}" width="24" height="24" style="display: block;" />`);
    } else {
      md.appendMarkdown(`<span style="font-size: 18px;">✨</span>`);
    }
    md.appendMarkdown(`</td>`);
    md.appendMarkdown(`<td style="vertical-align: middle;">`);
    md.appendMarkdown(`<h2 style="margin: 0; padding: 0; color: #34d399; font-weight: 900; letter-spacing: 0.5px; font-size: 16px; line-height: 24px;">`);
    md.appendMarkdown(`ZEROQUOTA <span style="font-size: 11px; color: #9ca3af; font-weight: 500; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; margin-left: 6px; vertical-align: middle;">v1.0.0</span>`);
    md.appendMarkdown(`</h2>`);
    md.appendMarkdown(`</td>`);
    md.appendMarkdown(`</tr>`);
    md.appendMarkdown(`</table>`);

    // Divider
    md.appendMarkdown(`<hr style="border: 0; height: 1px; background: rgba(16, 185, 129, 0.2); margin: 10px 0;" />`);

    // User & Tier Line
    md.appendMarkdown(`<table style="width: 100%; border-collapse: collapse;">`);
    md.appendMarkdown(`<tr>`);
    md.appendMarkdown(`<td style="color: #e2e8f0; font-size: 12px; font-weight: 500;">`);
    md.appendMarkdown(`$(account) &nbsp;${status.email}`);
    md.appendMarkdown(`</td>`);
    md.appendMarkdown(`<td style="text-align: right;">`);
    md.appendMarkdown(`<span style="color: #fbbf24; font-size: 11px; font-weight: 700; background: rgba(251, 191, 36, 0.15); padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(251, 191, 36, 0.3);">`);
    md.appendMarkdown(`$(star-full) &nbsp;${status.tier}`);
    md.appendMarkdown(`</span>`);
    md.appendMarkdown(`</td>`);
    md.appendMarkdown(`</tr>`);
    md.appendMarkdown(`</table>`);
    
    md.appendMarkdown(`</div>`);

    // Model Dashboard
    md.appendMarkdown(`<table style="width: 100%; border-collapse: collapse;">`);

    // Intercept and map items to deduplicate first
    const itemsToDisplay: { displayName: string, frac: number, pct: number, reset: string }[] = [];
    const displayedModels = new Set<string>();

    for (const m of status.modelConfigs) {
      if (!m.quotaInfo) continue;

      let displayName = m.label;
      if (m.label.includes("Gemini") && m.label.includes("Pro")) {
        displayName = "Gemini Pro";
      } else if (m.label.includes("Gemini") && m.label.includes("Flash")) {
        displayName = "Gemini Flash";
      } else if (m.label.includes("Claude")) {
        displayName = "Claude Opus 4.6";
      } else if (m.label.toLowerCase().includes("gpt")) {
        displayName = "GPT OSS";
      } else {
        displayName = m.label.replace(/\(.*\)/, "").trim();
      }

      if (displayedModels.has(displayName)) continue;
      displayedModels.add(displayName);

      const frac = m.quotaInfo.remainingFraction;
      const pct = Math.round(frac * 100);
      const reset = this.formatResetTime(m.quotaInfo.resetTime);
      
      itemsToDisplay.push({ displayName, frac, pct, reset });
    }

    // Explictly Sort the Models
    const sortOrder = ["Gemini Pro", "Gemini Flash", "Claude Opus 4.6", "GPT OSS"];
    itemsToDisplay.sort((a, b) => {
       let idxA = sortOrder.indexOf(a.displayName);
       let idxB = sortOrder.indexOf(b.displayName);
       if (idxA === -1) idxA = 99;
       if (idxB === -1) idxB = 99;
       return idxA - idxB;
    });

    for (const item of itemsToDisplay) {
      const statusColor = item.frac > 0.4 ? "#ccff00" : item.frac > 0.2 ? "#fbbf24" : "#f87171";
      const circleSvg = this.generateStatusCircle(statusColor);
      const progressBar = this.generateProgressBar(item.frac, statusColor);
      const brandIcon = this.getBrandIcon(item.displayName);

      md.appendMarkdown(`<tr style="height: 52px;">`);
      
      // Icon & Name
      md.appendMarkdown(`<td style="width: 180px; white-space: nowrap; padding-bottom: 12px;">`);
      md.appendMarkdown(`<img src="${circleSvg}" width="10" height="10" /> &nbsp; `);
      if (brandIcon) {
        md.appendMarkdown(`<img src="${brandIcon}" width="18" height="18" /> &nbsp; `);
      }
      md.appendMarkdown(`<span style="font-size: 14px; font-weight: 600; color: #eeeeee;">${item.displayName}</span>`);
      md.appendMarkdown(`</td>`);

      // Progress Bar - tight fit (280px total width)
      md.appendMarkdown(`<td style="width: 280px; padding-bottom: 12px;">`);
      md.appendMarkdown(`<img src="${progressBar}" width="280" height="14" style="display: block; margin: 0;" />`);
      md.appendMarkdown(`</td>`);

      // Percentage & Reset - left aligned with left padding
      md.appendMarkdown(`<td style="text-align: left; padding-left: 8px; white-space: nowrap; padding-bottom: 12px;">`);
      md.appendMarkdown(`<span style="font-size: 14px; color: #ffffff; font-weight: 700;">${item.pct}%</span> &nbsp; `);
      md.appendMarkdown(`<span style="color: #666666; font-size: 11px;">$(history) ${item.reset}</span>`);
      md.appendMarkdown(`</td>`);

      md.appendMarkdown(`</tr>`);
    }

    md.appendMarkdown(`</table>`);
    md.appendMarkdown(`</div>`);

    // Interactive Footer - Using explicit standard Markdown syntax so the hovers stay "sticky"
    md.appendMarkdown(`\n\n---\n\n`); // Force a markdown line break out of the HTML block
    md.appendMarkdown(`[$(sync) Refresh Quota](command:zeroquota.refresh) &nbsp;&nbsp;|&nbsp;&nbsp; [$(circuit-board) Brain](command:zeroquota.openBrain) &nbsp;&nbsp;|&nbsp;&nbsp; [$(json) MCP Config](command:zeroquota.openMcpConfig)\n`);

    // Ensure tooltip is fully trusted to allow command execution
    md.isTrusted = true;
    
    return md;
  }

  private getAppLogo(): string {
    const iconPath = path.join(this.context.extensionPath, "icons", "ZeroQuota.svg");
    try {
      if (fs.existsSync(iconPath)) {
        const content = fs.readFileSync(iconPath, "utf8");
        // Ensure the logo path is filled specifically with a prominent color if it isn't set
        const coloredContent = content.replace(/<path /g, '<path fill="#34d399" ');
        const b64 = Buffer.from(coloredContent).toString("base64");
        return `data:image/svg+xml;base64,${b64}`;
      }
    } catch(e) {}
    return "";
  }

  private getBrandIcon(label: string): string {
    const lower = label.toLowerCase();
    let filename = "";
    if (lower.includes("claude")) filename = "claude.svg";
    else if (lower.includes("gemini") || lower.includes("google"))
      filename = "google.svg";
    else if (lower.includes("gpt") || lower.includes("openai"))
      filename = "gpt.svg";

    if (!filename) return "";

    try {
      const iconPath = path.join(this.context.extensionPath, "icons", filename);
      if (fs.existsSync(iconPath)) {
        const content = fs.readFileSync(iconPath, "utf8");
        // For brand icons, let's use a cleaner white/light-grey for better contrast
        const coloredContent = content.replace(
          /fill="currentColor"/g,
          'fill="#d1d5db"',
        );
        const b64 = Buffer.from(coloredContent).toString("base64");
        return `data:image/svg+xml;base64,${b64}`;
      }
    } catch (e) {
      console.error("[ZeroQuota] Icon loading error:", e);
    }
    return "";
  }

  private generateStatusCircle(color: string): string {
    // Advanced circle with subtle inner glow
    const svg = `
    <svg width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <circle cx="7" cy="7" r="5" fill="${color}" filter="url(#glow)" stroke="rgba(255,255,255,0.2)" stroke-width="0.5" />
    </svg>`.trim();
    const b64 = Buffer.from(svg).toString("base64");
    return `data:image/svg+xml;base64,${b64}`;
  }

  private generateProgressBar(fraction: number, color: string): string {
    const width = 140;
    const height = 10;
    const filledWidth = Math.max(0, Math.min(width, width * fraction));

    // Dashboard-style progress bar with background track and glow
    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" rx="5" fill="#374151" stroke="rgba(255,255,255,0.05)" stroke-width="0.5" />
      <rect width="${filledWidth}" height="${height}" rx="5" fill="${color}" style="filter: drop-shadow(0 0 2px ${color});" />
    </svg>`.trim();
    const b64 = Buffer.from(svg).toString("base64");
    return `data:image/svg+xml;base64,${b64}`;
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
