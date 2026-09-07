/**
 * ZeroQuota - Antigravity IDE Extension
 * Copyright (c) 2026 kalidahmdev
 * Licensed under the MIT License
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { UserStatus, ModelConfig, ModelPickerConfig, TrajectoryInfo } from "../types";
import { getQuotaColor } from "./utils";

export class DashboardViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "zeroquota.dashboard";

  private _view?: vscode.WebviewView;
  private _latestStatus: UserStatus | null = null;
  private _trajectories: Record<string, TrajectoryInfo> | null = null;
  private _updateInterval?: NodeJS.Timeout;
  private _usageHistory: Record<string, number[]> = {};
  private _settingsVisible: boolean = false;
  private _pendingHtmlUpdate: boolean = false;
  private _lastSeenStatus: Record<string, { remaining: number; resetTime?: string }> = {};
  private _collapsedSections: Record<string, boolean> = {
    "model-usage": false,
    "brain-directory": true,
  };

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
        case "rules":
          vscode.commands.executeCommand("zeroquota.openRules");
          break;
        case "skills":
        case "workflows":
          vscode.commands.executeCommand("zeroquota.openSkills");
          break;
        case "persistSectionState": {
          if (message.section && typeof message.collapsed === "boolean") {
            this._collapsedSections[message.section] = message.collapsed;
          }
          break;
        }
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
        case "persistSettingsState": {
          const wasVisible = this._settingsVisible;
          this._settingsVisible = Boolean(message.visible);
          if (wasVisible && !this._settingsVisible && this._pendingHtmlUpdate) {
            this._pendingHtmlUpdate = false;
            this._updateHtml();
          }
          break;
        }
        case "saveSettings":
          (async () => {
            const config = vscode.workspace.getConfiguration("zeroquota");

            // Save threshold to global state and workspace configuration only if changed
            if (message.settings.threshold !== undefined) {
              const numVal = parseInt(String(message.settings.threshold), 10);
              this._context.globalState.update(
                "zeroquota.notificationThreshold",
                message.settings.threshold,
              );
              const currentThreshold = config.get<number>("notificationThreshold");
              if (!isNaN(numVal) && numVal !== currentThreshold) {
                await config.update(
                  "notificationThreshold",
                  numVal,
                  vscode.ConfigurationTarget.Global,
                );
              }
            }

            // Save notifyOnReset only if changed
            if (message.settings.notifyOnReset !== undefined) {
              const newNotify = Boolean(message.settings.notifyOnReset);
              this._context.globalState.update(
                "zeroquota.notifyOnReset",
                newNotify,
              );
              const currentNotify = config.get<boolean>("notifyOnReset");
              if (currentNotify !== newNotify) {
                await config.update(
                  "notifyOnReset",
                  newNotify,
                  vscode.ConfigurationTarget.Global,
                );
              }
            }

            // Save modelPicker only if changed
            if (message.settings.modelPicker) {
              const currentPicker = config.get<Record<string, boolean>>("modelPicker");
              if (JSON.stringify(currentPicker) !== JSON.stringify(message.settings.modelPicker)) {
                await config.update(
                  "modelPicker",
                  message.settings.modelPicker,
                  vscode.ConfigurationTarget.Global,
                );
              }
            }

            // Save refreshRate only if changed
            if (message.settings.refreshRate) {
              const currentRate = config.get<string>("refreshRate");
              if (currentRate !== message.settings.refreshRate) {
                await config.update(
                  "refreshRate",
                  message.settings.refreshRate,
                  vscode.ConfigurationTarget.Global,
                );
              }
            }

            // Save adaptivePolling only if changed
            if (message.settings.adaptivePolling !== undefined) {
              const newAdaptive = Boolean(message.settings.adaptivePolling);
              const currentAdaptive = config.get<boolean>("adaptivePolling");
              if (currentAdaptive !== newAdaptive) {
                await config.update(
                  "adaptivePolling",
                  newAdaptive,
                  vscode.ConfigurationTarget.Global,
                );
              }
            }

            // Save autoSyncBrain only if changed
            if (message.settings.autoSyncBrain !== undefined) {
              const newAutoSync = Boolean(message.settings.autoSyncBrain);
              const currentAutoSync = config.get<boolean>("autoSyncBrain");
              if (currentAutoSync !== newAutoSync) {
                await config.update(
                  "autoSyncBrain",
                  newAutoSync,
                  vscode.ConfigurationTarget.Global,
                );
              }
            }
          })();
          break;
      }
    });

    // Auto-refresh the brain directory periodically if the webview is visible and autoSyncBrain is enabled
    this._updateInterval = setInterval(() => {
      if (this._view?.visible) {
        const autoSync = vscode.workspace
          .getConfiguration("zeroquota")
          .get<boolean>("autoSyncBrain", true);
        if (autoSync) {
          this._updateHtml();
        }
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

  public update(status: UserStatus | null, trajectories?: Record<string, TrajectoryInfo> | null) {
    this._latestStatus = status;
    if (trajectories !== undefined) {
      this._trajectories = trajectories;
    }
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

    const categories: Array<{
      key: string;
      pool: "gemini" | "claude";
      config?: ModelConfig;
    }> = [
      {
        key: "Gemini Pro",
        pool: "gemini",
        config: status.modelConfigs.find(
          (m) =>
            m.label.includes("Gemini") &&
            m.label.includes("Pro") &&
            m.quotaInfo,
        ),
      },
      {
        key: "Gemini Flash",
        pool: "gemini",
        config: status.modelConfigs.find(
          (m) =>
            m.label.includes("Gemini") &&
            m.label.includes("Flash") &&
            m.quotaInfo,
        ),
      },
      {
        key: "Claude Opus 4.6",
        pool: "claude",
        config: status.modelConfigs.find(
          (m) => m.label.includes("Claude") && m.quotaInfo,
        ),
      },
      {
        key: "GPT OSS",
        pool: "claude",
        config: status.modelConfigs.find(
          (m) => m.label.toLowerCase().includes("gpt") && m.quotaInfo,
        ),
      },
    ];

    // Determine active category from activeModelLabel or activeModel
    let activeKey: string | undefined;
    const activeLabel = status.activeModelLabel || status.activeModel || "";
    if (activeLabel) {
      if (activeLabel.includes("Gemini") && activeLabel.includes("Pro")) {
        activeKey = "Gemini Pro";
      } else if (
        activeLabel.includes("Gemini") &&
        activeLabel.includes("Flash")
      ) {
        activeKey = "Gemini Flash";
      } else if (activeLabel.includes("Claude")) {
        activeKey = "Claude Opus 4.6";
      } else if (activeLabel.toLowerCase().includes("gpt")) {
        activeKey = "GPT OSS";
      }
    }

    categories.forEach(({ key, pool, config }) => {
      if (!config) return;

      const currentRemaining = config.quotaInfo?.remainingFraction ?? 1;
      const currentResetTime = config.quotaInfo?.resetTime;
      const lastStatus = this._lastSeenStatus[key];

      // Detect Reset:
      // 1. If we have a last status and the current remaining is GREATER than last seen and high (>= 0.99)
      // 2. OR if resetTime has changed to a later string
      const isReset = Boolean(
        lastStatus &&
          ((currentRemaining > lastStatus.remaining &&
            currentRemaining > 0.99) ||
            (currentResetTime &&
              lastStatus.resetTime &&
              currentResetTime !== lastStatus.resetTime)),
      );

      if (isReset) {
        this._usageHistory[key] = [];
      }

      if (!this._usageHistory[key]) {
        this._usageHistory[key] = [];
      }

      // Delta calculation:
      let delta = 0;
      if (lastStatus && !isReset) {
        const rawDelta = Math.max(0, lastStatus.remaining - currentRemaining);
        const poolMatchesActive =
          (pool === "gemini" &&
            (activeKey === "Gemini Pro" || activeKey === "Gemini Flash")) ||
          (pool === "claude" &&
            (activeKey === "Claude Opus 4.6" || activeKey === "GPT OSS"));

        if (poolMatchesActive) {
          delta = activeKey === key ? rawDelta : 0;
        } else {
          delta = rawDelta;
        }
      }

      this._usageHistory[key].push(delta);

      while (this._usageHistory[key].length > 20) {
        this._usageHistory[key].shift();
      }

      // Update tracker
      this._lastSeenStatus[key] = {
        remaining: currentRemaining,
        resetTime: currentResetTime,
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

    // If settings modal is open, defer re-rendering HTML to avoid closing/opening glitches
    if (this._settingsVisible) {
      this._pendingHtmlUpdate = true;
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

          const trajectory = this._trajectories
            ? this._trajectories[folder.name]
            : undefined;
          const folderTitle = trajectory?.summary
            ? trajectory.summary
            : folder.name;
          const stepBadge = trajectory?.stepCount
            ? `${trajectory.stepCount} steps`
            : `${subFiles.length}`;

          html += `<div class="brain-folder" data-session-id="${folder.name}">
                    <div class="tree-item" onclick="toggleFolder(this)" title="${folder.name}">
                        <span class="codicon codicon-folder"></span>
                        <div class="tree-folder-title">
                            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 175px;">${folderTitle}</span>
                            <span class="tree-count">${stepBadge}</span>
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
      const storedHistory =
        this._usageHistory[label] ||
        (label.includes("Claude")
          ? this._usageHistory["Claude Opus 4.6"]
          : undefined) ||
        [0];
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
    const initialThreshold = String(
      config.get<number>("notificationThreshold") ??
        this._context.globalState.get("zeroquota.notificationThreshold", 25),
    );
    const initialNotifyReset = Boolean(
      config.get<boolean>("notifyOnReset") ??
        this._context.globalState.get("zeroquota.notifyOnReset", false),
    );
    const initialModelPicker = config.get<ModelPickerConfig>("modelPicker", {
      geminiPro: true,
      geminiFlash: true,
      claude: true,
      gptOss: true,
    });
    const initialRefreshRate = config.get<string>("refreshRate", "1m");
    const initialAdaptivePolling = config.get<boolean>("adaptivePolling", true);
    const initialAutoSync = config.get<boolean>("autoSyncBrain", true);

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
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            transition: margin-bottom 0.2s ease;
        }

        .card-header.clickable {
            cursor: pointer;
            user-select: none;
        }

        .card-header.clickable:hover .card-title {
            color: var(--neon-green);
        }

        .toggle-icon {
            font-size: 11px;
            margin-right: 2px;
            color: var(--text-muted);
            transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            display: inline-block;
        }

        .card.collapsed .toggle-icon {
            transform: rotate(-90deg);
        }

        .card.collapsed {
            flex: 0 0 auto !important;
            min-height: 0 !important;
            margin-bottom: 8px !important;
            padding-bottom: 14px;
        }

        .card.collapsed .card-header {
            margin-bottom: 0 !important;
        }

        .card.collapsed .collapsible-content {
            display: none !important;
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

        /* Settings Modal Backdrop & Dialog */
        #settings-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.65);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 12px;
            box-sizing: border-box;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease;
        }

        #settings-backdrop.visible {
            opacity: 1;
            pointer-events: auto;
        }

        #settings-modal {
            width: 100%;
            max-width: 420px;
            max-height: 85vh;
            background: var(--bg-card);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-lg);
            box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.05);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transform: scale(0.95);
            transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        #settings-backdrop.visible #settings-modal {
            transform: scale(1);
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 14px 16px;
            border-bottom: 1px solid var(--border-subtle);
            background: rgba(255, 255, 255, 0.02);
        }

        .modal-title {
            font-size: 14px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--text-main);
        }

        .modal-close {
            cursor: pointer;
            color: var(--text-muted);
            font-size: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            border-radius: 4px;
            transition: background 0.15s, color 0.15s;
        }

        .modal-close:hover {
            background: var(--item-hover);
            color: var(--text-main);
        }

        .modal-body {
            padding: 16px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .setting-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .setting-label {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-muted);
            margin: 0;
            display: block;
        }

        .setting-description {
            font-size: 11px;
            color: var(--text-muted);
            line-height: 1.4;
            margin: 0;
        }

        .modal-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            border-top: 1px solid var(--border-subtle);
            background: rgba(255, 255, 255, 0.02);
            gap: 8px;
        }

        .save-indicator {
            font-size: 11px;
            color: var(--neon-green);
            opacity: 0;
            transition: opacity 0.3s ease;
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .save-indicator.show {
            opacity: 1;
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
            <span class="codicon codicon-settings-gear" onclick="toggleSettings(event)"></span>
        </div>
    </div>

    <!-- Settings Modal Dialog -->
    <div id="settings-backdrop"${settingsVisible ? ' class="visible"' : ''} onclick="handleBackdropClick(event)">
        <div id="settings-modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div class="modal-title">
                    <span class="codicon codicon-settings-gear" style="color: var(--neon-green);"></span>
                    Settings
                </div>
                <span class="codicon codicon-close modal-close" onclick="toggleSettings(event)" title="Close (Esc)"></span>
            </div>
            
            <div class="modal-body">
                <!-- Group 1: Notifications -->
                <div class="setting-group">
                    <label class="setting-label">Quota Threshold Notification</label>
                    <select id="threshold-select" onchange="toggleCustomThreshold()">
                        <option value="0">Disabled (None)</option>
                        <option value="10">10% Remaining</option>
                        <option value="25">25% Remaining</option>
                        <option value="50">50% Remaining</option>
                        <option value="custom">Custom...</option>
                    </select>
                    <div id="custom-threshold-container" class="custom-input-group" style="display: none; margin-top: 6px;">
                        <div class="custom-input-wrapper">
                            <input type="number" id="custom-threshold-input" class="custom-input" placeholder="e.g. 15" min="1" max="99" onchange="saveSettings()">
                            <span class="custom-input-suffix">%</span>
                        </div>
                    </div>
                    <p class="setting-description">
                        Receive a notification when any active model drops below this remaining quota level.
                    </p>
                    
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-main); margin-top: 6px; cursor: pointer;">
                        <input type="checkbox" id="notify-reset" onchange="saveSettings()"> 
                        Notify me when quotas are fully reset
                    </label>
                </div>

                <!-- Group 2: Model Picker -->
                <div class="setting-group">
                    <label class="setting-label">Visible Models</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; color: var(--text-main);">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="model-geminipro" onchange="saveSettings()"> Gemini Pro
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="model-geminiflash" onchange="saveSettings()"> Gemini Flash
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="model-claude" onchange="saveSettings()"> Claude
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="model-gptoss" onchange="saveSettings()"> GPT OSS
                        </label>
                    </div>
                </div>

                <!-- Group 3: Refresh Rate -->
                <div class="setting-group">
                    <label class="setting-label">Polling Refresh Rate</label>
                    <select id="refreshrate-select" onchange="saveSettings()">
                        <option value="Real-time">Real-time (10s)</option>
                        <option value="1m">1 minute</option>
                        <option value="5m">5 minutes</option>
                        <option value="Manual">Manual only</option>
                    </select>

                    <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-main); margin-top: 8px; cursor: pointer;">
                        <input type="checkbox" id="adaptive-polling" onchange="saveSettings()"> 
                        Smart adaptive polling (save CPU & battery when exhausted)
                    </label>
                    <p class="setting-description">
                        When all quotas hit 0%, automatically steps down polling frequency and wakes up near the reset time.
                    </p>
                </div>

                <!-- Group 4: Brain Sync -->
                <div class="setting-group">
                    <label style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-main); cursor: pointer;">
                        <span>Auto-Sync Brain Folder</span>
                        <input type="checkbox" id="autosync-checkbox" onchange="saveSettings()">
                    </label>
                    <p class="setting-description">
                        Periodically scan and display conversations and checkpoints in ~/.gemini/antigravity/brain.
                    </p>
                </div>
            </div>

            <div class="modal-footer">
                <div class="save-indicator" id="save-indicator">
                    <span class="codicon codicon-check"></span>
                    <span>Saved</span>
                </div>
                <div style="display: flex; gap: 8px; margin-left: auto;">
                    <button class="btn" style="background: transparent; border: 1px solid var(--border-subtle); color: var(--text-muted); font-size: 11px; padding: 6px 10px;" onclick="openAdvancedSettings()">Advanced...</button>
                    <button class="btn btn-primary" style="padding: 6px 14px; font-size: 12px;" onclick="toggleSettings(event)">Done</button>
                </div>
            </div>
        </div>
    </div>

    <div class="scrollable" style="flex: 1; display: flex; flex-direction: column; overflow-y: auto; overflow-x: hidden; padding-right: 4px;">
        <!-- Plan Info Card -->
        <div class="card" style="display: flex; align-items: center; gap: 16px; padding: 16px; margin-bottom: 20px;">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--neon-faint); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden;">
                ${status?.profilePictureUrl
                    ? `<img src="${status.profilePictureUrl}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;" />`
                    : `<span class="codicon codicon-account" style="color: var(--neon-green); font-size: 24px;"></span>`
                }
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 14px; font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${status?.name ? status.name.trim().split(/\s+/)[0] : "Account"}</span>
                    <span style="font-size: 10px; font-weight: 800; color: var(--neon-green); background: var(--neon-badge); border: 1px solid var(--neon-border); padding: 2px 6px; border-radius: 4px; text-transform: uppercase; flex-shrink: 0;">${tier}</span>
                </div>
                <span style="font-size: 11px; font-weight: 500; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${email}</span>
                ${(status?.promptCredits || status?.flowCredits) ? `
                <div style="display: flex; gap: 10px; margin-top: 4px; font-size: 10px; color: var(--text-muted);">
                    <span title="Prompt Credits (Available / Total)">⚡ <strong>${status.availablePromptCredits}</strong>/${status.promptCredits}</span>
                    <span title="Flow Credits (Available / Total)">🌊 <strong>${status.availableFlowCredits}</strong>/${status.flowCredits}</span>
                </div>
                ` : ""}
            </div>
        </div>

        <!-- Model Usage Card -->
        <div class="card ${this._collapsedSections['model-usage'] ? 'collapsed' : ''}" id="model-usage-card">
            <div class="card-header clickable" onclick="toggleSection('model-usage')" title="Click to collapse / expand">
                <div class="card-title">
                    <span class="codicon codicon-chevron-down toggle-icon" id="model-usage-chevron"></span>
                    <span class="codicon codicon-zap" style="color: var(--neon-green)"></span>
                    Model Usage
                </div>
                <div class="card-actions" onclick="event.stopPropagation()">
                    <span class="codicon codicon-info" title="• Real-time API quota telemetry&#10;• High-fidelity burn-rate tracking&#10;• Spikes show token use intensity&#10;• Resets follow provider cycles"></span>
                </div>
            </div>

            <div class="collapsible-content" id="model-usage-content">
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
        </div>

        <!-- Brain Directory Card -->
        <div class="card ${this._collapsedSections['brain-directory'] ? 'collapsed' : ''}" id="brain-directory-card" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; margin-bottom: 0; min-height: 90px;">
            <div class="card-header clickable" onclick="toggleSection('brain-directory')" title="Click to collapse / expand">
                <div class="card-title">
                    <span class="codicon codicon-chevron-down toggle-icon" id="brain-directory-chevron"></span>
                    <span class="codicon codicon-folder-active"></span>
                    Brain Directory
                </div>
                <div style="display: flex; align-items: center; gap: 6px;" onclick="event.stopPropagation()">
                    <span id="folder-count-badge" class="tree-count">${folderCount} Folders</span>
                    <span class="codicon codicon-info" title="• Implementation plans & task logs&#10;• Shared media & conversation assets&#10;• Organized naturally by session&#10;• Persistent workspace storage" style="font-size: 11px; cursor: help; color: var(--text-muted); opacity: 0.8;"></span>
                </div>
            </div>

            <div class="collapsible-content" id="brain-directory-content" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0;">
                <div class="search-container">
                    <input type="text" class="search-input" id="brainSearch" placeholder="Search directory..." oninput="filterBrain()">
                    <span class="codicon codicon-search search-icon"></span>
                </div>

                <div class="tree-container" id="brain-tree">
                    ${brainHtml}
                </div>
            </div>
        </div>
    </div>

    <div class="footer">
        <button class="btn btn-primary" onclick="sendMessage('refresh')">
            <span class="codicon codicon-sync"></span> Refresh Quotas
        </button>
        <div class="btn-row">
            <button class="btn" onclick="sendMessage('rules')" title="Open Antigravity Rules (GEMINI.md)">
                <span class="codicon codicon-book"></span> Rules
            </button>
            <button class="btn" onclick="sendMessage('skills')" title="Open Antigravity Skills">
                <span class="codicon codicon-symbol-event"></span> Skills
            </button>
        </div>
        <div class="btn-row">
            <button class="btn" onclick="sendMessage('mcp')" title="Open MCP Server Configuration">
                <span class="codicon codicon-circuit-board"></span> MCP
            </button>
            <button class="btn" onclick="sendMessage('reload')" title="Reload Antigravity IDE Window">
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

        function toggleSection(sectionId) {
            const card = document.getElementById(sectionId + '-card');
            if (!card) return;
            const isCollapsed = card.classList.toggle('collapsed');
            
            try {
                localStorage.setItem('zeroquota.collapsed.' + sectionId, isCollapsed ? 'true' : 'false');
                const state = vscode.getState() || {};
                state['collapsed_' + sectionId] = isCollapsed;
                vscode.setState(state);
            } catch (e) {}

            vscode.postMessage({
                command: 'persistSectionState',
                section: sectionId,
                collapsed: isCollapsed
            });
        }

        (function restoreSectionStates() {
            ['model-usage', 'brain-directory'].forEach(sectionId => {
                try {
                    const saved = localStorage.getItem('zeroquota.collapsed.' + sectionId);
                    if (saved !== null) {
                        const card = document.getElementById(sectionId + '-card');
                        if (card) {
                            if (saved === 'true') {
                                card.classList.add('collapsed');
                            } else {
                                card.classList.remove('collapsed');
                            }
                        }
                    }
                } catch (e) {}
            });
        })();

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
                const sessionId = folder.getAttribute('data-session-id') ? folder.getAttribute('data-session-id').toLowerCase() : "";
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

                if (title.includes(query) || sessionId.includes(query) || hasVisibleFile) {
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
            document.getElementById('settings-backdrop').classList.add('visible');
        }

        function toggleSettings(e) {
            if (e && e.stopPropagation) {
                e.stopPropagation();
            }
            const backdrop = document.getElementById('settings-backdrop');
            isSettingsVisible = !isSettingsVisible;
            if (isSettingsVisible) {
                backdrop.classList.add('visible');
            } else {
                backdrop.classList.remove('visible');
            }
            // Notify the back-end about state change so it can persist it
            vscode.postMessage({ command: 'persistSettingsState', visible: isSettingsVisible });
        }

        function handleBackdropClick(e) {
            if (e.target.id === 'settings-backdrop') {
                toggleSettings(e);
            }
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isSettingsVisible) {
                toggleSettings(e);
            }
        });

        function openAdvancedSettings() {
            vscode.postMessage({ command: 'openLocalSettings' });
        }

        function showSavedFeedback() {
            const indicator = document.getElementById('save-indicator');
            if (indicator) {
                indicator.classList.add('show');
                clearTimeout(indicator._timeout);
                indicator._timeout = setTimeout(() => {
                    indicator.classList.remove('show');
                }, 1500);
            }
        }

        function toggleCustomThreshold() {
            const select = document.getElementById('threshold-select');
            const customContainer = document.getElementById('custom-threshold-container');
            if (select.value === 'custom') {
                customContainer.style.display = 'block';
                const input = document.getElementById('custom-threshold-input');
                if (input) input.focus();
            } else {
                customContainer.style.display = 'none';
                saveSettings();
            }
        }

        let saveTimeout = null;
        function saveSettings() {
            showSavedFeedback();
            if (saveTimeout) clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
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
                const adaptivePolling = document.getElementById('adaptive-polling').checked;
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
                        adaptivePolling,
                        autoSyncBrain: autoSync
                    }
                });
            }, 100);
        }

        // Load initial settings
        const initialThreshold = ${JSON.stringify(initialThreshold)};
        const thresholdSelect = document.getElementById('threshold-select');
        const customInput = document.getElementById('custom-threshold-input');
        
        if (['0', '10', '25', '50'].includes(initialThreshold)) {
            thresholdSelect.value = initialThreshold;
        } else {
            thresholdSelect.value = 'custom';
            document.getElementById('custom-threshold-container').style.display = 'block';
            customInput.value = initialThreshold;
        }
        
        document.getElementById('notify-reset').checked = ${initialNotifyReset};
        document.getElementById('model-geminipro').checked = ${initialModelPicker?.geminiPro ?? true};
        document.getElementById('model-geminiflash').checked = ${initialModelPicker?.geminiFlash ?? true};
        document.getElementById('model-claude').checked = ${initialModelPicker?.claude ?? true};
        document.getElementById('model-gptoss').checked = ${initialModelPicker?.gptOss ?? true};
        
        document.getElementById('refreshrate-select').value = ${JSON.stringify(initialRefreshRate)};
        document.getElementById('adaptive-polling').checked = ${initialAdaptivePolling};
        document.getElementById('autosync-checkbox').checked = ${initialAutoSync};
    </script>
</body>
</html>`;
  }
}
