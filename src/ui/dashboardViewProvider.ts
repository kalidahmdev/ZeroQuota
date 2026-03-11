import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { UserStatus } from "../services/sidecarService";

export class DashboardViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "zeroquota.dashboard";

  private _view?: vscode.WebviewView;
  private _latestStatus: UserStatus | null = null;
  private _updateInterval?: NodeJS.Timeout;
  private _usageHistory: Record<string, number[]> = {};

  constructor(private readonly _context: vscode.ExtensionContext) {
    // Initialize usage history from global state
    this._usageHistory =
      this._context.globalState.get("zeroquota.usageHistory") || {};
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
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
        case "refresh":
          vscode.commands.executeCommand("zeroquota.refresh");
          break;
        case "mcp":
          vscode.commands.executeCommand("zeroquota.openMcpConfig");
          break;
        case "reload":
          vscode.commands.executeCommand("workbench.action.reloadWindow");
          break;
        case "openFile":
          vscode.commands.executeCommand(
            "vscode.open",
            vscode.Uri.file(message.path),
          );
          break;
        case "saveSettings":
          const { settings } = message;
          if (settings.threshold) {
             this._context.globalState.update(
               "zeroquota.notificationThreshold",
               settings.threshold,
             );
          }
          
          const config = vscode.workspace.getConfiguration("zeroquota");
          
          if (settings.modelPicker) {
              config.update("modelPicker", settings.modelPicker, vscode.ConfigurationTarget.Global);
          }
          if (settings.refreshRate) {
              config.update("refreshRate", settings.refreshRate, vscode.ConfigurationTarget.Global);
          }
          if (settings.autoSyncBrain !== undefined) {
              config.update("autoSyncBrain", settings.autoSyncBrain, vscode.ConfigurationTarget.Global);
          }
          if (settings.historyWindow) {
              config.update("historyWindow", settings.historyWindow, vscode.ConfigurationTarget.Global);
          }

          vscode.window.showInformationMessage("ZeroQuota settings saved.");
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

    // Update every 30 mins as requested, or if never updated
    if (now - lastUpdate < 30 * 60 * 1000 && lastUpdate !== 0) return;

    status.modelConfigs.forEach((config) => {
      const label = config.label;
      const frac = config.quotaInfo?.remainingFraction ?? 1;
      const used = 1 - frac;

      if (!this._usageHistory[label]) {
        this._usageHistory[label] = [];
      }

      this._usageHistory[label].push(used);
      if (this._usageHistory[label].length > 10) {
        this._usageHistory[label].shift();
      }
    });

    this._context.globalState.update(
      "zeroquota.usageHistory",
      this._usageHistory,
    );
    this._context.globalState.update("zeroquota.lastHistoryUpdate", now);
  }

  private async _updateHtml() {
    if (!this._view) {
      return;
    }

    const brainHtml = await this._getBrainDirectoryHtml();
    this._view.webview.html = this._getHtmlForWebview(
      this._latestStatus,
      brainHtml,
    );
  }

  private async _getBrainDirectoryHtml(): Promise<string> {
    const brainPath = path.join(
      os.homedir(),
      ".gemini",
      "antigravity",
      "brain",
    );

    let html = "";
    try {
      if (!fs.existsSync(brainPath)) {
        return `<div class="empty-state">Brain folder not found</div>`;
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
            else if ([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"].includes(ext)) iconClass = "codicon-file-media";
            
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
        else if ([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"].includes(ext)) iconClass = "codicon-file-media";

        html += `<div class="tree-item brain-file standalone" onclick="openFile('${filePath.replace(/\\/g, "\\\\")}')">
                <span class="codicon ${iconClass}"></span>
                <span>${file.name}</span>
            </div>`;
      }

      if (folders.length === 0 && files.length === 0) {
        html += `<div class="empty-state">Empty brain directory</div>`;
      }
    } catch (e) {
      return `<div class="empty-state">Error reading brain directory</div>`;
    }

    return html;
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

  private _getHtmlForWebview(
    status: UserStatus | null,
    brainHtml: string,
  ): string {
    const tier = status?.tier || "N/A";
    const email = status?.email || "Not Signed In";

    const configs = status?.modelConfigs || [];

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
      const frac = m.quotaInfo.remainingFraction;
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
      return this._view?.webview.asWebviewUri(
        vscode.Uri.joinPath(this._context.extensionUri, "icons", `${name}.svg`),
      );
    };

    const getColor = (frac: number) => {
      if (frac > 0.4) return "#ccff00"; // Premium Neon Green
      if (frac > 0.2) return "#fbbf24"; // Warning Yellow
      return "#f87171"; // Error Red
    };

    // Helper for sparklines
    const getSparkline = (label: string) => {
      const history = this._usageHistory[label] || [
        0.1, 0.2, 0.15, 0.3, 0.25, 0.4, 0.35, 0.5, 0.45, 0.6,
      ];
      const points = history.map((val, i) => `${i * 4},${10 - val * 10}`);

      return `<svg width="40" height="12" viewBox="0 0 40 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,10 ${points.join(" ")}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"/>
        </svg>`;
    };

        const config = vscode.workspace.getConfiguration("zeroquota");
        
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ZeroQuota Dashboard</title>
    <link href="${this._view?.webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, "node_modules", "@vscode", "codicons", "dist", "codicon.css"))}" rel="stylesheet" />
    <style>
        :root {
            --bg-deep: #0a0a0a;
            --bg-card: rgba(255, 255, 255, 0.03);
            --border-subtle: rgba(255, 255, 255, 0.08);
            --neon-green: #ccff00;
            --text-main: #e2e8f0;
            --text-muted: #94a3b8;
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
            justify-content: space-between;
            margin-bottom: 20px;
            padding: 0 4px;
        }

        .header-title {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--text-muted);
        }

        .header-actions {
            display: flex;
            gap: 12px;
            color: var(--text-muted);
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
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
            overflow: hidden;
            position: relative;
        }

        .progress-fill {
            height: 100%;
            border-radius: 4px;
            transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Brain Directory */
        .search-container {
            position: relative;
            margin-bottom: 12px;
        }

        .search-input {
            width: 100%;
            background: rgba(255, 255, 255, 0.05);
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
            max-height: 300px;
            overflow-y: auto;
            font-size: 12px;
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
            background: rgba(255, 255, 255, 0.05);
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
            color: black;
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
            background: rgba(255, 255, 255, 0.08);
            border-color: var(--text-muted);
        }

        .btn-primary {
            background: var(--neon-green);
            color: black;
            border: none;
        }

        .btn-primary:hover {
            background: #b3df00;
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
            background: rgba(10, 10, 10, 0.95);
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
            background: var(--bg-card);
            border: 1px solid var(--border-subtle);
            color: var(--text-main);
            padding: 8px;
            border-radius: var(--radius-md);
            outline: none;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-title">ZeroQuota: Dashboard</div>
        <div class="header-actions">
            <span class="codicon codicon-settings-gear" onclick="toggleSettings()"></span>
            <span class="codicon codicon-menu"></span>
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
            <select id="threshold-select" onchange="saveSettings()">
                <option value="0">None</option>
                <option value="10">10% Remaining</option>
                <option value="25">25% Remaining</option>
                <option value="50">50% Remaining</option>
            </select>
            <p style="font-size: 10px; color: var(--text-muted); margin-top: 8px;">
                You will receive a notification when your model quota drops below this level.
            </p>
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

        <div class="setting-group">
            <label class="setting-label">History Window</label>
            <select id="historywindow-select" onchange="saveSettings()">
                <option value="5h">Last 5h</option>
                <option value="12h">Last 12h</option>
                <option value="24h">Last 24h</option>
            </select>
        </div>
        
        <div style="margin-top: auto; padding-bottom: 20px;">
            <button class="btn btn-primary" style="width: 100%;" onclick="toggleSettings()">Done</button>
        </div>
    </div>

    <div class="scrollable" style="flex: 1; overflow-y: auto; padding-right: 4px;">
        <!-- Plan Info Card -->
        <div class="card" style="display: flex; align-items: center; gap: 16px; padding: 16px; margin-bottom: 20px;">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(204, 255, 0, 0.08); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <span class="codicon codicon-account" style="color: var(--neon-green); font-size: 24px;"></span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px; flex: 1;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 14px; font-weight: 700; color: #ffffff;">Account</span>
                    <span style="font-size: 10px; font-weight: 800; color: var(--neon-green); background: rgba(204, 255, 0, 0.1); border: 1px solid rgba(204, 255, 0, 0.3); padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">${tier}</span>
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
                    <span class="codicon codicon-info" title="High/Low variants supported"></span>
                    <span class="codicon codicon-chevron-right"></span>
                </div>
            </div>

            ${config.get<any>("modelPicker", {})?.geminiPro !== false ? `
            <div class="quota-item">
                <div class="quota-info">
                    <div class="quota-label">
                        <img src="${getIconUri("google")}" width="14" height="14" style="vertical-align: middle; margin-right: 4px;">
                        Gemini Pro
                    </div>
                    <div class="quota-percentage" style="color: ${getColor(proFrac)}">${proPct}%</div>
                </div>
                <div class="progress-container">
                    <div class="progress-fill" style="width: ${proPct}%; background: ${getColor(proFrac)}; box-shadow: 0 0 10px ${getColor(proFrac)}44;"></div>
                </div>
                <div class="quota-meta">
                    <span>Reset in: ${proReset}</span>
                    <span>${getSparkline(proLabel)}</span>
                </div>
            </div>
            ` : ""}

            ${config.get<any>("modelPicker", {})?.geminiFlash !== false ? `
            <div class="quota-item">
                <div class="quota-info">
                    <div class="quota-label">
                        <img src="${getIconUri("google")}" width="14" height="14" style="vertical-align: middle; margin-right: 4px;">
                        Gemini Flash
                    </div>
                    <div class="quota-percentage" style="color: ${getColor(flashFrac)}">${flashPct}%</div>
                </div>
                <div class="progress-container">
                    <div class="progress-fill" style="width: ${flashPct}%; background: ${getColor(flashFrac)}; box-shadow: 0 0 10px ${getColor(flashFrac)}44;"></div>
                </div>
                <div class="quota-meta">
                    <span>Reset in: ${flashReset}</span>
                    <span>${getSparkline(flashLabel)}</span>
                </div>
            </div>
            ` : ""}

            ${config.get<any>("modelPicker", {})?.claude !== false ? `
            <div class="quota-item">
                <div class="quota-info">
                    <div class="quota-label">
                        <img src="${getIconUri("claude")}" width="14" height="14" style="vertical-align: middle; margin-right: 4px;">
                        Claude
                    </div>
                    <div class="quota-percentage" style="color: ${getColor(claudeFrac)}">${claudePct}%</div>
                </div>
                <div class="progress-container">
                    <div class="progress-fill" style="width: ${claudePct}%; background: ${getColor(claudeFrac)}; box-shadow: 0 0 10px ${getColor(claudeFrac)}44;"></div>
                </div>
                <div class="quota-meta">
                    <span>Reset in: ${claudeReset}</span>
                    <span>${getSparkline(claudeLabel)}</span>
                </div>
            </div>
            ` : ""}

            ${config.get<any>("modelPicker", {})?.gptOss !== false ? `
            <div class="quota-item">
                <div class="quota-info">
                    <div class="quota-label">
                        <img src="${getIconUri("gpt")}" width="14" height="14" style="vertical-align: middle; margin-right: 4px;">
                        GPT OSS
                    </div>
                    <div class="quota-percentage" style="color: ${getColor(gptFrac)}">${gptPct}%</div>
                </div>
                <div class="progress-container">
                    <div class="progress-fill" style="width: ${gptPct}%; background: ${getColor(gptFrac)}; box-shadow: 0 0 10px ${getColor(gptFrac)}44;"></div>
                </div>
                <div class="quota-meta">
                    <span>Reset in: ${gptReset}</span>
                    <span>${getSparkline(gptLabel)}</span>
                </div>
            </div>
            ` : ""}
        </div>

        <!-- Brain Directory Card -->
        <div class="card">
            <div class="card-header">
                <div class="card-title">
                    <span class="codicon codicon-folder-active"></span>
                    Brain Directory
                </div>
                <span id="folder-count-badge" class="tree-count">0 Folders</span>
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

        function updateFolderCount() {
            const visibleFolders = Array.from(document.querySelectorAll('.brain-folder')).filter(f => !f.classList.contains('hidden')).length;
            document.getElementById('folder-count-badge').innerText = \`\${visibleFolders} Folders\`;
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

            updateFolderCount();
        }

        function toggleSettings() {
            document.getElementById('settings-overlay').classList.toggle('visible');
        }

        function saveSettings() {
            const threshold = document.getElementById('threshold-select').value;
            const modelGeminiPro = document.getElementById('model-geminipro').checked;
            const modelGeminiFlash = document.getElementById('model-geminiflash').checked;
            const modelClaude = document.getElementById('model-claude').checked;
            const modelGptOss = document.getElementById('model-gptoss').checked;
            const refreshRate = document.getElementById('refreshrate-select').value;
            const autoSync = document.getElementById('autosync-checkbox').checked;
            const historyWindow = document.getElementById('historywindow-select').value;

            vscode.postMessage({ 
                command: 'saveSettings', 
                settings: {
                    threshold,
                    modelPicker: {
                        geminiPro: modelGeminiPro,
                        geminiFlash: modelGeminiFlash,
                        claude: modelClaude,
                        gptOss: modelGptOss
                    },
                    refreshRate,
                    autoSyncBrain: autoSync,
                    historyWindow
                }
            });
        }

        // Load initial settings
        const initialThreshold = "${this._context.globalState.get("zeroquota.notificationThreshold", "25")}";
        document.getElementById('threshold-select').value = initialThreshold;

        // Note: The rest of the settings are Workspace Configurations, not Global State
        const config = ${JSON.stringify(vscode.workspace.getConfiguration("zeroquota"))};
        
        document.getElementById('model-geminipro').checked = config.modelPicker?.geminiPro ?? true;
        document.getElementById('model-geminiflash').checked = config.modelPicker?.geminiFlash ?? true;
        document.getElementById('model-claude').checked = config.modelPicker?.claude ?? true;
        document.getElementById('model-gptoss').checked = config.modelPicker?.gptOss ?? true;
        
        document.getElementById('refreshrate-select').value = config.refreshRate || "1m";
        document.getElementById('autosync-checkbox').checked = config.autoSyncBrain ?? true;
        document.getElementById('historywindow-select').value = config.historyWindow || "12h";

        // Initial count
        updateFolderCount();
    </script>
</body>
</html>`;
  }
}
