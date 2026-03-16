/**
 * ZeroQuota - Antigravity IDE Extension
 * Copyright (c) 2026 kalidahmdev
 * Licensed under the MIT License
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { UserStatus, ModelPickerConfig } from "../types";
import { getQuotaColor } from "./utils";

export class DashboardViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "zeroquota.dashboard";

  private _view?: vscode.WebviewView;
  private _latestStatus: UserStatus | null = null;
  private _updateInterval?: NodeJS.Timeout;
  private _usageHistory: Record<string, number[]> = {};
  private _settingsVisible: boolean = false;
  private _lastSeenStatus: Record<string, { remaining: number; resetTime?: string }> = {};

  constructor(private readonly _context: vscode.ExtensionContext) {
    // Initialize usage history and last status from global state
    this._usageHistory =
      this._context.globalState.get("zeroquota.usageHistory") || {};
    this._lastSeenStatus =
      this._context.globalState.get("zeroquota.lastSeenStatus") || {};
    this._context.subscriptions.push(
      vscode.window.onDidChangeActiveColorTheme(() => {
        this._updateHtml();
      }),
    );
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext, // eslint-disable-line @typescript-eslint/no-unused-vars
    _token: vscode.CancellationToken, // eslint-disable-line @typescript-eslint/no-unused-vars
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._context.extensionUri],
    };

    // Initial render
    this._updateHtml();

    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case "openLocalSettings":
          vscode.commands.executeCommand(
            "workbench.action.openSettings",
            "zeroquota",
          );
          break;
        case "refresh":
          vscode.commands.executeCommand("zeroquota.refresh");
          break;
        case "mcp":
          vscode.commands.executeCommand("zeroquota.openMcpConfig");
          break;
        case "reload":
          vscode.commands.executeCommand("zeroquota.reload");
          break;
        case "openFile":
          vscode.commands.executeCommand(
            "vscode.open",
            vscode.Uri.file(message.path),
          );
          break;
        case "persistSettingsState":
          this._settingsVisible = message.visible;
          break;
        case "saveSettings":
          (async () => {
            // Save threshold to global state
            if (message.settings.threshold !== undefined) {
              this._context.globalState.update(
                "zeroquota.notificationThreshold",
                message.settings.threshold,
              );
            }

            // Save notifyOnReset to global state
            if (message.settings.notifyOnReset !== undefined) {
              this._context.globalState.update(
                "zeroquota.notifyOnReset",
                message.settings.notifyOnReset,
              );
            }

            // Save the rest to workspace configuration
            const config = vscode.workspace.getConfiguration("zeroquota");

            if (message.settings.modelPicker) {
              await config.update(
                "modelPicker",
                message.settings.modelPicker,
                vscode.ConfigurationTarget.Global,
              );
            }
            if (message.settings.refreshRate) {
              await config.update(
                "refreshRate",
                message.settings.refreshRate,
                vscode.ConfigurationTarget.Global,
              );
            }
            if (message.settings.autoSyncBrain !== undefined) {
              await config.update(
                "autoSyncBrain",
                message.settings.autoSyncBrain,
                vscode.ConfigurationTarget.Global,
              );
            }

            vscode.window.showInformationMessage(
              "Settings saved successfully!",
            );
          })();
          break;
      }
    });

    // Auto-refresh the brain directory periodically if the webview is visible
    this._updateInterval = setInterval(() => {
      if (this._view?.visible) {
        this._updateHtml();
      }
    }, 5000);

    webviewView.onDidDispose(() => {
      if (this._updateInterval) {
        clearInterval(this._updateInterval);
      }
      this._view = undefined;
    });

    webviewView.onDidChangeVisibility(() => {
      if (this._view?.visible) {
        this._updateHtml();
      }
    });
  }

  public update(status: UserStatus | null) {
    this._latestStatus = status;
    this._updateUsageHistory(status);
    this._updateHtml();
  }

  private _updateUsageHistory(status: UserStatus | null) {
    if (!status) return;

    const now = Date.now();
    const lastUpdate =
      this._context.globalState.get<number>("zeroquota.lastHistoryUpdate") || 0;

    // Update every 1 minute to show more activity in the spikes
    if (now - lastUpdate < 1 * 60 * 1000 && lastUpdate !== 0) return;

    status.modelConfigs.forEach((config) => {
      let key = config.label;
      // Map keys to match the ones used in _getHtmlForWebview mapping
      if (key.includes("Gemini") && key.includes("Pro")) key = "Gemini Pro";
      else if (key.includes("Gemini") && key.includes("Flash")) key = "Gemini Flash";
      else if (key.includes("Claude")) key = "Claude Opus 4.6";
      else if (key.toLowerCase().includes("gpt")) key = "GPT OSS";

      const currentRemaining = config.quotaInfo?.remainingFraction ?? 1;
      const currentResetTime = config.quotaInfo?.resetTime;
      const lastStatus = this._lastSeenStatus[key];

      // Detect Reset:
      // 1. If we have a last status and the current remaining is GREATER than last seen and high (>= 0.99)
      // 2. OR if resetTime has changed to a later string
      const isReset = lastStatus && (
        (currentRemaining > lastStatus.remaining && currentRemaining > 0.99) ||
        (currentResetTime && lastStatus.resetTime && currentResetTime !== lastStatus.resetTime)
      );

      if (isReset) {
        this._usageHistory[key] = [];
      }

      if (!this._usageHistory[key]) {
        this._usageHistory[key] = [];
      }

      // Delta calculation: How much was used since last check?
      // If it's the first time or a reset, delta is 0 relative to "start"
      let delta = 0;
      if (lastStatus && !isReset) {
        delta = Math.max(0, lastStatus.remaining - currentRemaining);
      }

      // Only push if there's usage OR if we want to show a 0 usage point
      this._usageHistory[key].push(delta);
      
      if (this._usageHistory[key].length > 20) {
        this._usageHistory[key].shift();
      }

      // Update tracker
      this._lastSeenStatus[key] = {
        remaining: currentRemaining,
        resetTime: currentResetTime
      };
    });

    this._context.globalState.update(
      "zeroquota.usageHistory",
      this._usageHistory,
    );
    this._context.globalState.update(
      "zeroquota.lastSeenStatus",
      this._lastSeenStatus,
    );
    this._context.globalState.update("zeroquota.lastHistoryUpdate", now);
  }

  private async _updateHtml() {
    if (!this._view) {
      return;
    }

    const { html: brainHtml, count: folderCount } =
      await this._getBrainDirectoryHtml();
    this._view.webview.html = this._getHtmlForWebview(
      this._latestStatus,
      brainHtml,
      folderCount,
      this._settingsVisible,
    );
  }

  private async _getBrainDirectoryHtml(): Promise<{
    html: string;
    count: number;
  }> {
    const brainPath = path.join(
      os.homedir(),
      ".gemini",
      "antigravity",
      "brain",
    );

    let html = "";
    let folderCount = 0;
    try {
      if (!fs.existsSync(brainPath)) {
        return {
          html: `<div class="empty-state">Brain folder not found</div>`,
          count: 0,
        };
      }

      const items = await fs.promises.readdir(brainPath, {
        withFileTypes: true,
      });

      // Get stats for sorting
      const itemsWithStats = await Promise.all(
        items.map(async (item) => {
          const stats = await fs.promises.stat(path.join(brainPath, item.name));
          return { item, mtime: stats.mtime };
        }),
      );

      // Sort: newest first
      itemsWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      const folders = itemsWithStats
        .filter((i) => i.item.isDirectory())
        .map((i) => i.item);
      folderCount = folders.length;
      const files = itemsWithStats
        .filter((i) => i.item.isFile())
        .map((i) => i.item);

      for (const folder of folders) {
        const folderPath = path.join(brainPath, folder.name);
        try {
          const subItems = await fs.promises.readdir(folderPath, {
            withFileTypes: true,
          });
          const subFiles = subItems.filter((item) => item.isFile());

          html += `<div class="brain-folder">
                    <div class="tree-item" onclick="toggleFolder(this)">
                        <span class="codicon codicon-folder"></span>
                        <div class="tree-folder-title">
                            <span>${folder.name}</span>
                            <span class="tree-count">${subFiles.length}</span>
                        </div>
                    </div>
                    <div class="tree-guide hidden">`;

          for (const file of subFiles) {
            const filePath = path.join(folderPath, file.name);
            const ext = path.extname(file.name).toLowerCase();
            let iconClass = "codicon-file";
            if (ext === ".md") iconClass = "codicon-markdown";
            else if (
              [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"].includes(ext)
            )
              iconClass = "codicon-file-media";

            html += `<div class="tree-item brain-file" onclick="openFile('${filePath.replace(/\\/g, "\\\\")}')">
                        <span class="codicon ${iconClass}"></span>
                        <span>${file.name}</span>
                    </div>`;
          }

          if (subFiles.length === 0) {
            html += `<div class="empty-state">Empty</div>`;
          }

          html += `</div></div>`;
        } catch (e) {
          html += `<div class="empty-state">Error reading</div>`;
        }
      }

      for (const file of files) {
        const filePath = path.join(brainPath, file.name);
        const ext = path.extname(file.name).toLowerCase();
        let iconClass = "codicon-file";
        if (ext === ".md") iconClass = "codicon-markdown";
        else if (
          [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"].includes(ext)
        )
          iconClass = "codicon-file-media";

        html += `<div class="tree-item brain-file standalone" onclick="openFile('${filePath.replace(/\\/g, "\\\\")}')">
                <span class="codicon ${iconClass}"></span>
                <span>${file.name}</span>
            </div>`;
      }

      if (folders.length === 0 && files.length === 0) {
        html += `<div class="empty-state">Empty brain directory</div>`;
      }
    } catch (e) {
      return {
        html: `<div class="empty-state">Error reading brain directory</div>`,
        count: 0,
      };
    }

    return { html, count: folderCount };
  }

  private _formatResetTime(resetTimeStr?: string): string {
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

  private _getThemePalette() {
    const isLight =
      vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light;
    // Brand neon green #ccff00. In light mode, we use black for contrast if requested.
    const neonGreen = isLight ? "#000000" : "#ccff00";

    return {
      bgDeep: "var(--vscode-panel-background)",
      bgCard: "var(--vscode-editorWidget-background)",
      borderSubtle: "var(--vscode-editorWidget-border)",
      progressTrack: isLight
        ? "rgba(0, 0, 0, 0.08)"
        : "rgba(255, 255, 255, 0.12)",
      inputBg: "var(--vscode-input-background)",
      itemHover: "var(--vscode-list-hoverBackground)",
      buttonHover: "var(--vscode-button-hoverBackground)",
      neonGreen: neonGreen,
      neonContrast: isLight ? "#ffffff" : "#000000",
      neonFaint: isLight ? "rgba(0, 0, 0, 0.05)" : "rgba(204, 255, 0, 0.08)",
      neonBadge: isLight ? "rgba(0, 0, 0, 0.1)" : "rgba(204, 255, 0, 0.18)",
      neonBorder: isLight ? "rgba(0, 0, 0, 0.2)" : "rgba(204, 255, 0, 0.3)",
      neonGlow: isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(204, 255, 0, 0.12)",
      overlayBg: isLight
        ? "rgba(255, 255, 255, 0.95)"
        : "rgba(10, 10, 10, 0.95)",
      glowStrength: isLight ? "0px" : "10px",
      textMain: "var(--vscode-editor-foreground)",
      textMuted: "var(--vscode-descriptionForeground)",
    };
  }

  private _getHtmlForWebview(
    status: UserStatus | null,
    brainHtml: string,
    folderCount: number,
    settingsVisible: boolean = false,
  ): string {
    const tier = status?.tier || "N/A";
    const email = status?.email || "Not Signed In";

    const configs = status?.modelConfigs || [];
    const palette = this._getThemePalette();

    // Exact mapping logic for the top 3 models
    let proPct = 0,
      proFrac = 0,
      proReset = "N/A",
      proLabel = "Gemini Pro";
    let flashPct = 0,
      flashFrac = 0,
      flashReset = "N/A",
      flashLabel = "Gemini Flash";
    let claudePct = 0,
      claudeFrac = 0,
      claudeReset = "N/A",
      claudeLabel = "Claude";
    let gptPct = 0,
      gptFrac = 0,
      gptReset = "N/A",
      gptLabel = "GPT OSS";

    for (const m of configs) {
      if (!m.quotaInfo) continue;
      const bFrac = m.quotaInfo.remainingFraction ?? 0;
      const frac = isNaN(bFrac) ? 0 : bFrac;
      const pct = Math.round(frac * 100);
      const reset = this._formatResetTime(m.quotaInfo.resetTime);

      if (m.label.includes("Gemini") && m.label.includes("Pro")) {
        proPct = pct;
        proFrac = frac;
        proReset = reset;
        proLabel = "Gemini Pro";
      } else if (m.label.includes("Gemini") && m.label.includes("Flash")) {
        flashPct = pct;
        flashFrac = frac;
        flashReset = reset;
        flashLabel = "Gemini Flash";
      } else if (m.label.includes("Claude")) {
        // If it's Claude, we enforce the explicitly requested name "Claude Opus 4.6"
        // and we only capture the first one we find so Opus/Sonnet don't overwrite each other.
        if (claudePct === 0 || m.label.includes("Opus")) {
          claudePct = pct;
          claudeFrac = frac;
          claudeReset = reset;
          claudeLabel = "Claude Opus 4.6";
        }
      } else if (m.label.toLowerCase().includes("gpt")) {
        gptPct = pct;
        gptFrac = frac;
        gptReset = reset;
        gptLabel = "GPT OSS";
      }
    }

    const getIconUri = (name: string) => {
      const isLight =
        vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light;
      const iconColor = isLight ? "#444444" : "#d1d5db";
      const iconPath = path.join(
        this._context.extensionPath,
        "assets",
        "brands",
        `${name}.svg`,
      );
      try {
        if (fs.existsSync(iconPath)) {
          const content = fs.readFileSync(iconPath, "utf8");
          const coloredContent = content.replace(
            /fill="#[^"]*"/g,
            `fill="${iconColor}"`,
          );
          const b64 = Buffer.from(coloredContent).toString("base64");
          return `data:image/svg+xml;base64,${b64}`;
        }
      } catch (e) {
        console.error("[ZeroQuota] Icon loading error:", e);
      }
      return this._view?.webview.asWebviewUri(
        vscode.Uri.joinPath(
          this._context.extensionUri,
          "assets",
          "brands",
          `${name}.svg`,
        ),
      );
    };

    const getBrandLogo = () => {
      const isLight =
        vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light;
      const logoColor = isLight ? "#000000" : "#ccff00";
      const logoPath = path.join(
        this._context.extensionPath,
        "assets",
        "icons",
        "ZeroQuota.svg",
      );
      try {
        if (fs.existsSync(logoPath)) {
          const content = fs.readFileSync(logoPath, "utf8");
          // Replace existing fill attributes and add fill to paths without them
          const coloredContent = content
            .replace(/fill="#[^"]*"/g, `fill="${logoColor}"`)
            .replace(/<path(?![^>]*fill=)/g, `<path fill="${logoColor}"`);
          const b64 = Buffer.from(coloredContent).toString("base64");
          return `data:image/svg+xml;base64,${b64}`;
        }
      } catch (e) {
        console.error("[ZeroQuota] Logo loading error:", e);
      }
      return "";
    };

    const getColor = (frac: number) => {
      const color = getQuotaColor(frac);
      const isLight =
        vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light;
      if (isLight && color === "#ccff00") {
        return "#000000";
      }
      return color;
    };

    // Helper for sparklines
    const getSparkline = (label: string, color: string) => {
      const storedHistory = this._usageHistory[label] || [0];
      const paddingNeeded = 10 - storedHistory.length;
      const firstVal = storedHistory.length > 0 ? storedHistory[0] : 0;
      const history =
        paddingNeeded > 0
          ? [...Array(paddingNeeded).fill(firstVal), ...storedHistory]
          : storedHistory;

      // Map values to coordinates
      // Since these are deltas, we scale them relative to the max delta in the current history.
      const maxDelta = Math.max(0.05, ...history); // Minimum scale of 5% for visibility
      const pts = history.map((val, i) => ({
        x: i * (40 / (history.length - 1 || 1)), 
        y: 11 - (val / maxDelta) * 10, // Scale relative to max usage spike
      }));

      // Generate smooth path using simple cubic Bezier interpolation
      let pathD = `M ${pts[0].x},${pts[0].y}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        const cpX = (p0.x + p1.x) / 2;
        pathD += ` C ${cpX},${p0.y} ${cpX},${p1.y} ${p1.x},${p1.y}`;
      }

      const lastPt = pts[pts.length - 1];
      const isLight =
        vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light;
      const strokeColor = color;
      const id = label.replace(/\s+/g, '-').toLowerCase();

      return `<svg width="40" height="12" viewBox="0 0 40 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="overflow: visible;">
            <defs>
                <linearGradient id="grad-${id}" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.3" />
                    <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0" />
                </linearGradient>
            </defs>
            <path d="${pathD} L 40,12 L 0,12 Z" fill="url(#grad-${id})" />
            <path d="${pathD}" stroke="${strokeColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            <circle cx="${lastPt.x}" cy="${lastPt.y}" r="2" fill="${strokeColor}" />
            <circle cx="${lastPt.x}" cy="${lastPt.y}" r="3" stroke="${isLight ? '#fff' : '#000'}" stroke-width="1" fill="none" />
        </svg>`;
    };

    const config = vscode.workspace.getConfiguration("zeroquota");

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Overview</title>
    <link href="${this._view?.webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, "node_modules", "@vscode", "codicons", "dist", "codicon.css"))}" rel="stylesheet" />
    <style>
        :root {
            --bg-deep: ${palette.bgDeep};
            --bg-card: ${palette.bgCard};
            --border-subtle: ${palette.borderSubtle};
            --progress-track: ${palette.progressTrack};
            --input-bg: ${palette.inputBg};
            --item-hover: ${palette.itemHover};
            --button-hover: ${palette.buttonHover};
            --neon-green: ${palette.neonGreen};
            --neon-contrast: ${palette.neonContrast};
            --neon-faint: ${palette.neonFaint};
            --neon-badge: ${palette.neonBadge};
            --neon-border: ${palette.neonBorder};
            --neon-glow: ${palette.neonGlow};
            --overlay-bg: ${palette.overlayBg};
            --glow-strength: ${palette.glowStrength};
            --text-main: ${palette.textMain};
            --text-muted: ${palette.textMuted};
            --radius-lg: 12px;
            --radius-md: 8px;
            --font-main: 'Inter', var(--vscode-font-family), sans-serif;
        }
        
        body {
            font-family: var(--font-main);
            background-color: var(--bg-deep);
            color: var(--text-main);
            padding: 12px;
            margin: 0;
            display: flex;
            flex-direction: column;
            height: 100vh;
            box-sizing: border-box;
            overflow: hidden;
            position: relative;
        }

        .header {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 20px;
            padding: 0 4px;
            position: relative;
        }

        .header-brand {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .header-brand img {
            width: 40px;
            height: 40px;
            object-fit: contain;
        }

        .header-brand-text {
            font-size: 20px;
            font-weight: 600;
            color: var(--text-main);
            letter-spacing: 0.02em;
        }

        .header-actions {
            display: flex;
            gap: 12px;
            color: var(--text-muted);
            position: absolute;
            right: 4px;
            top: 50%;
            transform: translateY(-50%);
        }

        .header-actions .codicon {
            cursor: pointer;
            font-size: 16px;
            transition: color 0.2s;
        }

        .header-actions .codicon:hover {
            color: var(--text-main);
        }

        .card {
            background: var(--bg-card);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-lg);
            padding: 16px;
            margin-bottom: 12px;
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
        }

        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }

        .card-title {
            font-size: 13px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .card-subtitle {
            font-size: 11px;
            color: var(--text-muted);
            margin-top: 2px;
        }

        .card-actions {
            display: flex;
            gap: 8px;
            color: var(--text-muted);
        }

        .card-actions .codicon {
            font-size: 14px;
            cursor: pointer;
        }

        /* Quota Items */
        .quota-item {
            margin-bottom: 16px;
        }

        .quota-item:last-child {
            margin-bottom: 0;
        }

        .quota-info {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-bottom: 6px;
        }

        .quota-label {
            font-size: 12px;
            font-weight: 500;
        }

        .quota-percentage {
            font-size: 12px;
            font-weight: 700;
            font-family: monospace;
        }

        .quota-meta {
            font-size: 10px;
            color: var(--text-muted);
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 4px;
        }

        .progress-container {
            height: 8px;
            background: var(--progress-track);
            border-radius: 4px;
            overflow: hidden;
            position: relative;
        }

        .progress-fill {
            height: 100%;
            border-radius: 4px;
            transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 0 var(--glow-strength) currentColor;
        }

        /* Brain Directory */
        .search-container {
            position: relative;
            margin-bottom: 12px;
        }

        .search-input {
            width: 100%;
            background: var(--input-bg);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-md);
            padding: 8px 32px 8px 12px;
            font-family: var(--font-main);
            font-size: 12px;
            color: var(--text-main);
            box-sizing: border-box;
            outline: none;
            transition: border-color 0.2s;
        }

        .search-input:focus {
            border-color: var(--neon-green);
        }

        .search-icon {
            position: absolute;
            right: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted);
            font-size: 14px;
            pointer-events: none;
        }

        .tree-container {
            flex: 1;
            overflow-y: auto;
            font-size: 12px;
            padding-right: 2px;
            min-height: 0;
        }

        .tree-item {
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: background 0.2s;
        }

        .tree-item:hover {
            background: var(--item-hover);
        }

        .tree-folder-title {
            font-weight: 600;
            color: var(--text-main);
            display: flex;
            justify-content: space-between;
            width: 100%;
        }

        .tree-count {
            color: var(--text-muted);
            font-size: 10px;
        }

        .tree-guide {
            margin-left: 8px;
            padding-left: 12px;
            border-left: 1px solid var(--border-subtle);
        }

        /* Plan Info */
        .plan-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .plan-badge {
            background: var(--neon-green);
            color: var(--neon-contrast);
            font-size: 10px;
            font-weight: 800;
            padding: 2px 6px;
            border-radius: 4px;
            text-transform: uppercase;
        }

        .plan-expiry {
            font-size: 11px;
            color: var(--text-muted);
        }

        /* Footer Actions */
        .footer {
            margin-top: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding-top: 12px;
        }

        .btn {
            background: var(--bg-card);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-md);
            padding: 10px;
            color: var(--text-main);
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all 0.2s;
        }

        .btn:hover {
            background: var(--button-hover);
            border-color: var(--text-muted);
        }

        .btn-primary {
            background: var(--neon-green);
            color: var(--neon-contrast);
            border: none;
        }

        .btn-primary:hover {
            background: var(--neon-border);
            transform: translateY(-1px);
        }

        .btn-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }

        /* Custom Scrollbar */
        ::-webkit-scrollbar {
            width: 4px;
        }
        ::-webkit-scrollbar-track {
            background: transparent;
        }
        ::-webkit-scrollbar-thumb {
            background: var(--border-subtle);
            border-radius: 2px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: var(--text-muted);
        }

        .hidden { display: none !important; }

        /* Settings Overlay */
        #settings-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: var(--overlay-bg);
            backdrop-filter: blur(20px);
            z-index: 100;
            padding: 24px;
            display: flex;
            flex-direction: column;
            transform: translateY(100%);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        #settings-overlay.visible {
            transform: translateY(0);
        }

        .settings-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
        }

        .settings-title {
            font-size: 16px;
            font-weight: 700;
        }

        .setting-group {
            margin-bottom: 20px;
        }

        .setting-label {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-muted);
            margin-bottom: 8px;
            display: block;
        }

        select {
            width: 100%;
            background: var(--input-bg);
            border: 1px solid var(--border-subtle);
            color: var(--text-main);
            padding: 10px 12px;
            border-radius: var(--radius-md);
            outline: none;
            cursor: pointer;
            appearance: none;
            background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
            background-repeat: no-repeat;
            background-position: right 12px center;
            background-size: 16px;
            transition: border-color 0.2s, box-shadow 0.2s;
        }

        select:focus {
            border-color: var(--neon-green);
            box-shadow: 0 0 0 2px var(--neon-glow);
        }

        select:hover {
            border-color: var(--text-muted);
        }

        option {
            background-color: var(--input-bg);
            color: var(--text-main);
            padding: 10px;
        }

        .custom-input-group {
            display: none;
            margin-top: 8px;
            animation: slideDown 0.2s ease-out;
            position: relative;
        }

        .custom-input-wrapper {
            display: flex;
            align-items: center;
            gap: 8px;
            background: var(--input-bg);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-md);
            padding: 2px 12px 2px 2px;
            transition: border-color 0.2s;
        }

        .custom-input-wrapper:focus-within {
            border-color: var(--neon-green);
        }

        .custom-input {
            flex: 1;
            background: transparent;
            border: none;
            color: var(--text-main);
            padding: 8px 10px;
            outline: none;
            font-family: inherit;
            font-size: 13px;
        }

        .custom-input-suffix {
            color: var(--text-muted);
            font-size: 12px;
            font-weight: 600;
        }

        @keyframes slideDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-brand">
            <img src="${getBrandLogo()}" alt="ZeroQuota" />
            <span class="header-brand-text">ZeroQuota</span>
        </div>
        <div class="header-actions">
            <span class="codicon codicon-settings-gear" onclick="toggleSettings()"></span>
        </div>
    </div>

    <!-- Settings Overlay -->
    <div id="settings-overlay">
        <div class="settings-header">
            <div class="settings-title">Settings</div>
            <span class="codicon codicon-close" onclick="toggleSettings()" style="cursor: pointer;"></span>
        </div>
        
        <div class="setting-group">
            <label class="setting-label">Quota Notification Threshold</label>
            <select id="threshold-select" onchange="toggleCustomThreshold()">
                <option value="0">None</option>
                <option value="10">10% Remaining</option>
                <option value="25">25% Remaining</option>
                <option value="50">50% Remaining</option>
                <option value="custom">Custom...</option>
            </select>
            <div id="custom-threshold-container" class="custom-input-group">
                <div class="custom-input-wrapper">
                    <input type="number" id="custom-threshold-input" class="custom-input" placeholder="e.g. 15" min="1" max="99" onchange="saveSettings()">
                    <span class="custom-input-suffix">%</span>
                </div>
            </div>
            <p style="font-size: 10px; color: var(--text-muted); margin-top: 8px; margin-bottom: 12px;">
                You will receive a notification when your model quota drops below this level.
            </p>
            
            <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-main);">
                <input type="checkbox" id="notify-reset" onchange="saveSettings()"> 
                Notify me when quotas are fully reset
            </label>
        </div>

        <div class="setting-group">
            <label class="setting-label">Model Picker</label>
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px; color: var(--text-main);">
                <label style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="model-geminipro" onchange="saveSettings()"> Gemini Pro
                </label>
                <label style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="model-geminiflash" onchange="saveSettings()"> Gemini Flash
                </label>
                <label style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="model-claude" onchange="saveSettings()"> Claude
                </label>
                <label style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="model-gptoss" onchange="saveSettings()"> GPT OSS
                </label>
            </div>
        </div>

        <div class="setting-group">
            <label class="setting-label">Refresh Rate</label>
            <select id="refreshrate-select" onchange="saveSettings()">
                <option value="Real-time">Real-time</option>
                <option value="1m">1m</option>
                <option value="5m">5m</option>
                <option value="Manual">Manual</option>
            </select>
        </div>

        <div class="setting-group">
            <label class="setting-label" style="display: flex; justify-content: space-between; align-items: center;">
                Auto-Sync Brain
                <input type="checkbox" id="autosync-checkbox" onchange="saveSettings()">
            </label>
        </div>
        
        <div style="margin-top: auto; padding-bottom: 20px;">
            <button class="btn btn-primary" style="width: 100%;" onclick="toggleSettings()">Done</button>
        </div>
    </div>

    <div class="scrollable" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; padding-right: 4px;">
        <!-- Plan Info Card -->
        <div class="card" style="display: flex; align-items: center; gap: 16px; padding: 16px; margin-bottom: 20px;">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--neon-faint); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <span class="codicon codicon-account" style="color: var(--neon-green); font-size: 24px;"></span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px; flex: 1;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 14px; font-weight: 700; color: var(--text-main);">Account</span>
                    <span style="font-size: 10px; font-weight: 800; color: var(--neon-green); background: var(--neon-badge); border: 1px solid var(--neon-border); padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">${tier}</span>
                </div>
                <span style="font-size: 11px; font-weight: 500; color: var(--text-muted);">${email}</span>
            </div>
        </div>

        <!-- Model Usage Card -->
        <div class="card">
            <div class="card-header">
                <div class="card-title">
                    <span class="codicon codicon-zap" style="color: var(--neon-green)"></span>
                    Model Usage
                </div>
                <div class="card-actions">
                    <span class="codicon codicon-info" title="• Real-time API quota telemetry&#10;• High-fidelity burn-rate tracking&#10;• Spikes show token use intensity&#10;• Resets follow provider cycles"></span>
                </div>
            </div>

            ${
              config.get<ModelPickerConfig>("modelPicker", {})?.geminiPro !== false
                ? `
            <div class="quota-item">
                <div class="quota-info">
                    <div class="quota-label">
                        <img src="${getIconUri("google")}" width="14" height="14" style="vertical-align: middle; margin-right: 4px;">
                        Gemini Pro
                    </div>
                    <div class="quota-percentage" style="color: ${getColor(proFrac)}">${proPct}%</div>
                </div>
                <div class="progress-container">
                    <div class="progress-fill" style="width: ${proPct}%; background: ${getColor(proFrac)}; --glow-strength: ${palette.glowStrength === "0px" ? "0px" : "10px"}; color: ${getColor(proFrac)}44;"></div>
                </div>
                <div class="quota-meta">
                    <span>Reset in: ${proReset}</span>
                    <span>${getSparkline(proLabel, getColor(proFrac))}</span>
                </div>
            </div>
            `
                : ""
            }

            ${
              config.get<ModelPickerConfig>("modelPicker", {})?.geminiFlash !== false
                ? `
            <div class="quota-item">
                <div class="quota-info">
                    <div class="quota-label">
                        <img src="${getIconUri("google")}" width="14" height="14" style="vertical-align: middle; margin-right: 4px;">
                        Gemini Flash
                    </div>
                    <div class="quota-percentage" style="color: ${getColor(flashFrac)}">${flashPct}%</div>
                </div>
                <div class="progress-container">
                    <div class="progress-fill" style="width: ${flashPct}%; background: ${getColor(flashFrac)}; --glow-strength: ${palette.glowStrength === "0px" ? "0px" : "10px"}; color: ${getColor(flashFrac)}44;"></div>
                </div>
                <div class="quota-meta">
                    <span>Reset in: ${flashReset}</span>
                    <span>${getSparkline(flashLabel, getColor(flashFrac))}</span>
                </div>
            </div>
            `
                : ""
            }

            ${
              config.get<ModelPickerConfig>("modelPicker", {})?.claude !== false
                ? `
            <div class="quota-item">
                <div class="quota-info">
                    <div class="quota-label">
                        <img src="${getIconUri("claude")}" width="14" height="14" style="vertical-align: middle; margin-right: 4px;">
                        Claude
                    </div>
                    <div class="quota-percentage" style="color: ${getColor(claudeFrac)}">${claudePct}%</div>
                </div>
                <div class="progress-container">
                    <div class="progress-fill" style="width: ${claudePct}%; background: ${getColor(claudeFrac)}; --glow-strength: ${palette.glowStrength === "0px" ? "0px" : "10px"}; color: ${getColor(claudeFrac)}44;"></div>
                </div>
                <div class="quota-meta">
                    <span>Reset in: ${claudeReset}</span>
                    <span>${getSparkline(claudeLabel, getColor(claudeFrac))}</span>
                </div>
            </div>
            `
                : ""
            }

            ${
              config.get<ModelPickerConfig>("modelPicker", {})?.gptOss !== false
                ? `
            <div class="quota-item">
                <div class="quota-info">
                    <div class="quota-label">
                        <img src="${getIconUri("gpt")}" width="14" height="14" style="vertical-align: middle; margin-right: 4px;">
                        GPT OSS
                    </div>
                    <div class="quota-percentage" style="color: ${getColor(gptFrac)}">${gptPct}%</div>
                </div>
                <div class="progress-container">
                    <div class="progress-fill" style="width: ${gptPct}%; background: ${getColor(gptFrac)}; --glow-strength: ${palette.glowStrength === "0px" ? "0px" : "10px"}; color: ${getColor(gptFrac)}44;"></div>
                </div>
                <div class="quota-meta">
                    <span>Reset in: ${gptReset}</span>
                    <span>${getSparkline(gptLabel, getColor(gptFrac))}</span>
                </div>
            </div>
            `
                : ""
            }
        </div>

        <!-- Brain Directory Card -->
        <div class="card" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; margin-bottom: 0;">
            <div class="card-header">
                <div class="card-title">
                    <span class="codicon codicon-folder-active"></span>
                    Brain Directory
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span id="folder-count-badge" class="tree-count">${folderCount} Folders</span>
                    <span class="codicon codicon-info" title="• Implementation plans & task logs&#10;• Shared media & conversation assets&#10;• Organized naturally by session&#10;• Persistent workspace storage" style="font-size: 11px; cursor: help; color: var(--text-muted); opacity: 0.8;"></span>
                </div>
            </div>

            <div class="search-container">
                <input type="text" class="search-input" id="brainSearch" placeholder="Search directory..." oninput="filterBrain()">
                <span class="codicon codicon-search search-icon"></span>
            </div>

            <div class="tree-container" id="brain-tree">
                ${brainHtml}
            </div>
        </div>
    </div>

    <div class="footer">
        <button class="btn btn-primary" onclick="sendMessage('refresh')">
            <span class="codicon codicon-sync"></span> Refresh Quotas
        </button>
        <div class="btn-row">
            <button class="btn" onclick="sendMessage('mcp')">
                <span class="codicon codicon-circuit-board"></span> MCP
            </button>
            <button class="btn" onclick="sendMessage('reload')">
                <span class="codicon codicon-refresh"></span> Reload IDE
            </button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        function sendMessage(command) {
            vscode.postMessage({ command: command });
        }
        function openFile(path) {
            vscode.postMessage({ command: 'openFile', path: path });
        }

        function toggleFolder(el) {
            const guide = el.parentElement.querySelector('.tree-guide');
            const icon = el.querySelector('.codicon');
            guide.classList.toggle('hidden');
            icon.classList.toggle('codicon-folder');
            icon.classList.toggle('codicon-folder-opened');
        }

        function filterBrain() {
            const query = document.getElementById('brainSearch').value.toLowerCase();
            const folders = document.querySelectorAll('.brain-folder');
            const standaloneFiles = document.querySelectorAll('.brain-file.standalone');

            folders.forEach(folder => {
                const titleEl = folder.querySelector('.tree-folder-title span:first-child');
                const title = titleEl ? titleEl.innerText.toLowerCase() : "";
                const files = folder.querySelectorAll('.brain-file');
                let hasVisibleFile = false;

                files.forEach(file => {
                    const fileName = file.querySelector('span:last-child').innerText.toLowerCase();
                    if (fileName.includes(query)) {
                        file.classList.remove('hidden');
                        hasVisibleFile = true;
                    } else {
                        file.classList.add('hidden');
                    }
                });

                if (title.includes(query) || hasVisibleFile) {
                    folder.classList.remove('hidden');
                    if (query.length > 0) {
                        folder.querySelector('.tree-guide').classList.remove('hidden');
                        const icon = folder.querySelector('.codicon');
                        icon.classList.remove('codicon-folder');
                        icon.classList.add('codicon-folder-opened');
                    }
                } else {
                    folder.classList.add('hidden');
                }
            });

            standaloneFiles.forEach(file => {
                const fileName = file.querySelector('span:last-child').innerText.toLowerCase();
                if (fileName.includes(query)) {
                    file.classList.remove('hidden');
                } else {
                    file.classList.add('hidden');
                }
            });
        }

        let isSettingsVisible = ${settingsVisible ? "true" : "false"};
        
        // Apply initial state
        if (isSettingsVisible) {
            document.getElementById('settings-overlay').classList.add('visible');
        }

        function toggleSettings() {
            const overlay = document.getElementById('settings-overlay');
            isSettingsVisible = !isSettingsVisible;
            if (isSettingsVisible) {
                overlay.classList.add('visible');
            } else {
                overlay.classList.remove('visible');
            }
            // Notify the back-end about state change so it can persist it
            vscode.postMessage({ command: 'persistSettingsState', visible: isSettingsVisible });
        }

        function toggleCustomThreshold() {
            const select = document.getElementById('threshold-select');
            const customContainer = document.getElementById('custom-threshold-container');
            if (select.value === 'custom') {
                customContainer.style.display = 'block';
            } else {
                customContainer.style.display = 'none';
                saveSettings();
            }
        }

        function saveSettings() {
            let threshold = document.getElementById('threshold-select').value;
            if (threshold === 'custom') {
                threshold = document.getElementById('custom-threshold-input').value;
            }
            const notifyOnReset = document.getElementById('notify-reset').checked;
            
            const modelGeminiPro = document.getElementById('model-geminipro').checked;
            const modelGeminiFlash = document.getElementById('model-geminiflash').checked;
            const modelClaude = document.getElementById('model-claude').checked;
            const modelGptOss = document.getElementById('model-gptoss').checked;
            const refreshRate = document.getElementById('refreshrate-select').value;
            const autoSync = document.getElementById('autosync-checkbox').checked;

            vscode.postMessage({ 
                command: 'saveSettings', 
                settings: {
                    threshold,
                    notifyOnReset,
                    modelPicker: {
                        geminiPro: modelGeminiPro,
                        geminiFlash: modelGeminiFlash,
                        claude: modelClaude,
                        gptOss: modelGptOss
                    },
                    refreshRate,
                    autoSyncBrain: autoSync
                }
            });
        }

        // Load initial settings
        const initialThreshold = "${this._context.globalState.get("zeroquota.notificationThreshold", "25")}";
        const thresholdSelect = document.getElementById('threshold-select');
        const customInput = document.getElementById('custom-threshold-input');
        
        if (['0', '10', '25', '50'].includes(initialThreshold)) {
            thresholdSelect.value = initialThreshold;
        } else {
            thresholdSelect.value = 'custom';
            document.getElementById('custom-threshold-container').style.display = 'block';
            customInput.value = initialThreshold;
        }
        
        const initialNotifyReset = ${this._context.globalState.get("zeroquota.notifyOnReset", false) ? "true" : "false"};
        document.getElementById('notify-reset').checked = initialNotifyReset;

        // Note: The rest of the settings are Workspace Configurations, not Global State
        const config = ${JSON.stringify(vscode.workspace.getConfiguration("zeroquota"))};
        
        document.getElementById('model-geminipro').checked = config.modelPicker?.geminiPro ?? true;
        document.getElementById('model-geminiflash').checked = config.modelPicker?.geminiFlash ?? true;
        document.getElementById('model-claude').checked = config.modelPicker?.claude ?? true;
        document.getElementById('model-gptoss').checked = config.modelPicker?.gptOss ?? true;
        
        document.getElementById('refreshrate-select').value = config.refreshRate || "1m";
        document.getElementById('autosync-checkbox').checked = config.autoSyncBrain ?? true;
    </script>
</body>
</html>`;
  }
}
