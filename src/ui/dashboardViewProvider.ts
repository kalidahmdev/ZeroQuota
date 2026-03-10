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

  constructor(private readonly _context: vscode.ExtensionContext) {}

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
    this._updateHtml();
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
      const itemsWithStats = await Promise.all(items.map(async (item) => {
          const stats = await fs.promises.stat(path.join(brainPath, item.name));
          return { item, mtime: stats.mtime };
      }));

      // Sort: newest first
      itemsWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      const folders = itemsWithStats.filter(i => i.item.isDirectory()).map(i => i.item);
      const files = itemsWithStats.filter(i => i.item.isFile()).map(i => i.item);

      for (const folder of folders) {
        html += `<details class="brain-folder">
                <summary><span class="codicon codicon-folder"></span> ${folder.name}</summary>
                <div class="folder-contents">`;

        const folderPath = path.join(brainPath, folder.name);
        try {
          const subItems = await fs.promises.readdir(folderPath, {
            withFileTypes: true,
          });
          const subFiles = subItems.filter((item) => item.isFile());

          if (subFiles.length === 0) {
            html += `<div class="empty-state">Empty</div>`;
          }

          for (const file of subFiles) {
            const filePath = path.join(folderPath, file.name);
            // Standard VS Code link pattern for webview to post message
            html += `<div class="brain-file" onclick="openFile('${filePath.replace(/\\/g, "\\\\")}')">
                        <span class="codicon codicon-file"></span> ${file.name}
                    </div>`;
          }
        } catch (e) {
          html += `<div class="empty-state">Error reading</div>`;
        }
        html += `</div></details>`;
      }

      for (const file of files) {
        const filePath = path.join(brainPath, file.name);
        html += `<div class="brain-file standalone" onclick="openFile('${filePath.replace(/\\/g, "\\\\")}')">
                <span class="codicon codicon-file"></span> ${file.name}
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
    const isOffline = !status;
    const email = status?.email || "Offline";
    const tier = status?.tier || "N/A";

    const configs = status?.modelConfigs || [];

    // Exact mapping logic for the top 3 models
    let proPct = 0,
      proReset = "N/A",
      proFrac = 0;
    let flashPct = 0,
      flashReset = "N/A",
      flashFrac = 0;
    let claudePct = 0,
      claudeReset = "N/A",
      claudeFrac = 0;

    for (const m of configs) {
      if (!m.quotaInfo) continue;
      const frac = m.quotaInfo.remainingFraction;
      const pct = Math.round(frac * 100);
      const reset = this._formatResetTime(m.quotaInfo.resetTime);

      if (m.label.includes("Gemini") && m.label.includes("Pro")) {
        proPct = pct;
        proReset = reset;
        proFrac = frac;
      } else if (m.label.includes("Gemini") && m.label.includes("Flash")) {
        flashPct = pct;
        flashReset = reset;
        flashFrac = frac;
      } else if (
        m.label.includes("Claude") &&
        (m.label.includes("Opus") || m.label.includes("Sonnet"))
      ) {
        // Prioritize Opus or fallback to Sonnet if Opus not found yet
        if (m.label.includes("Opus") || claudeReset === "N/A") {
          claudePct = pct;
          claudeReset = reset;
          claudeFrac = frac;
        }
      }
    }

    const getColor = (frac: number) => {
      if (frac > 0.4) return "var(--vscode-testing-iconPassed)";
      if (frac > 0.2)
        return "var(--vscode-notificationsWarningIcon-foreground)";
      return "var(--vscode-notificationsErrorIcon-foreground)";
    };

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
            --padding: 16px;
            --radius-md: 8px;
            --radius-sm: 4px;
            --spacing-sm: 8px;
            --spacing-md: 12px;
            --spacing-lg: 16px;
        }
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
            background-color: var(--vscode-sideBar-background);
        }

        /* Container sections */
        .section {
            padding: var(--padding);
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .scrollable {
            flex: 1;
            overflow-y: auto;
        }

        .fixed-bottom {
            padding: var(--spacing-md) var(--padding);
            border-top: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-sideBar-background);
        }

        /* Account Header */
        .account-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: var(--spacing-sm);
        }
        .account-email {
            font-weight: 600;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .account-tier {
            font-size: 11px;
            font-weight: 700;
            color: #fbbf24;
            background: rgba(251, 191, 36, 0.15);
            padding: 2px 6px;
            border-radius: var(--radius-sm);
            border: 1px solid rgba(251, 191, 36, 0.3);
            display: flex;
            align-items: center;
            gap: 4px;
        }

        /* Section Title & Header */
        .section-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: var(--spacing-md);
        }
        .section-title {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 600;
            color: var(--vscode-descriptionForeground);
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 0;
        }

        /* Quotas */
        .quota-item {
            margin-bottom: var(--spacing-lg);
        }
        .quota-item:last-child {
            margin-bottom: 0;
        }
        .quota-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
        }
        .quota-name {
            font-weight: 600;
            font-size: 13px;
        }
        .quota-stats {
            font-size: 12px;
            font-weight: 600;
        }
        .quota-reset {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-left: 6px;
            font-weight: normal;
        }
        .progress-bar {
            width: 100%;
            height: 6px;
            background-color: var(--vscode-badge-background);
            border-radius: 3px;
            overflow: hidden;
            opacity: 0.8;
        }
        .progress-fill {
            height: 100%;
            border-radius: 3px;
            transition: width 0.3s ease;
        }

        /* Brain Directory */
        .brain-controls {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .master-summary {
            cursor: pointer;
            padding: 2px 6px;
            font-size: 11px;
            font-weight: 600;
            background-color: var(--vscode-button-secondaryBackground);
            border-radius: var(--radius-sm);
            display: flex;
            align-items: center;
            gap: 4px;
            color: var(--vscode-button-secondaryForeground);
            user-select: none;
        }
        .master-summary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .master-summary::marker { content: ""; }
        .master-summary::-webkit-details-marker { display: none; }
        .master-summary::before {
            content: '\eab4';
            font-family: 'codicon';
            transition: transform 0.2s;
            font-size: 10px;
            transform: rotate(90deg);
        }
        .master-summary.closed::before {
            transform: rotate(0deg);
        }

        .master-contents {
            margin-top: var(--spacing-md);
        }

        details.brain-folder {
            margin-bottom: 4px;
        }
        details.brain-folder > summary {
            cursor: pointer;
            padding: 6px;
            border-radius: var(--radius-sm);
            user-select: none;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            color: var(--vscode-foreground);
        }
        details.brain-folder > summary:hover {
            background-color: var(--vscode-list-hoverBackground);
            color: var(--vscode-list-hoverForeground);
        }
        /* Custom arrow for details */
        details.brain-folder > summary::marker {
            content: "";
        }
        details.brain-folder > summary::-webkit-details-marker {
            display: none;
        }
        details.brain-folder > summary::before {
            content: '\\eab4'; /* codicon-chevron-right */
            font-family: 'codicon';
            display: inline-block;
            transition: transform 0.2s;
            font-size: 14px;
        }
        details[open].brain-folder > summary::before {
            transform: rotate(90deg);
        }
        
        .folder-contents {
            margin-left: 16px;
            padding-left: 8px;
            border-left: 1px solid var(--vscode-tree-indentGuidesStroke);
            margin-top: 4px;
            margin-bottom: 8px;
        }

        .brain-file {
            cursor: pointer;
            padding: 4px 6px;
            border-radius: var(--radius-sm);
            font-size: 12px;
            color: var(--vscode-foreground);
            display: flex;
            align-items: center;
            gap: 6px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .brain-file.standalone {
            margin-left: 20px;
        }
        .brain-file:hover {
            background-color: var(--vscode-list-hoverBackground);
            color: var(--vscode-list-hoverForeground);
        }

        .empty-state {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            padding: 4px;
        }

        /* Buttons */
        .actions-grid {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .btn {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            width: 100%;
            transition: background-color 0.2s;
        }
        .btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .btn-primary:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        /* Icons */
        .codicon {
            font-size: 14px !important;
            vertical-align: middle;
        }
    </style>
</head>
<body>
    <div class="scrollable">
        <!-- Account Section -->
        <div class="section" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, transparent 100%);">
            <div class="account-header">
                <div class="account-email">
                    <span class="codicon codicon-account"></span>
                    ${email}
                </div>
                ${
                  !isOffline
                    ? `
                <div class="account-tier">
                    <span class="codicon codicon-star-full"></span>
                    ${tier}
                </div>
                `
                    : ""
                }
            </div>
            ${isOffline ? `<div class="empty-state">Waiting for language server...</div>` : ""}
        </div>

        ${
          !isOffline
            ? `
        <!-- Quotas Section -->
        <div class="section">
            <div class="section-title">
                <span class="codicon codicon-pulse"></span> QUOTAS
            </div>
            
            <div class="quota-item">
                <div class="quota-header">
                    <span class="quota-name">Gemini Pro</span>
                    <span class="quota-stats" style="color: ${getColor(proFrac)}">${proPct}% <span class="quota-reset"><span class="codicon codicon-history"></span>${proReset}</span></span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${proPct}%; background-color: ${getColor(proFrac)}; box-shadow: 0 0 4px ${getColor(proFrac)};"></div>
                </div>
            </div>

            <div class="quota-item">
                <div class="quota-header">
                    <span class="quota-name">Gemini Flash</span>
                    <span class="quota-stats" style="color: ${getColor(flashFrac)}">${flashPct}% <span class="quota-reset"><span class="codicon codicon-history"></span>${flashReset}</span></span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${flashPct}%; background-color: ${getColor(flashFrac)}; box-shadow: 0 0 4px ${getColor(flashFrac)};"></div>
                </div>
            </div>

            <div class="quota-item">
                <div class="quota-header">
                    <span class="quota-name">Claude</span>
                    <span class="quota-stats" style="color: ${getColor(claudeFrac)}">${claudePct}% <span class="quota-reset"><span class="codicon codicon-history"></span>${claudeReset}</span></span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${claudePct}%; background-color: ${getColor(claudeFrac)}; box-shadow: 0 0 4px ${getColor(claudeFrac)};"></div>
                </div>
            </div>
        </div>
        `
            : ""
        }

        <!-- Brain Section -->
        <div class="section" style="border-bottom: none;">
            <details class="brain-master-dropdown" open>
                <summary class="master-summary-wrapper" style="display: none;"></summary>
                <div class="section-header">
                    <div class="section-title">
                        <span class="codicon codicon-brain"></span> BRAIN DIRECTORY
                    </div>
                    <div class="brain-controls" onclick="event.stopPropagation()">
                        <div class="master-summary" onclick="const d = document.getElementById('brain-details'); d.toggleAttribute('open'); this.classList.toggle('closed')">
                            Folders & Files
                        </div>
                    </div>
                </div>
                <details id="brain-details" open style="display: contents;">
                    <summary style="display: none;"></summary>
                    <div id="brain-container" class="master-contents">
                        ${brainHtml}
                    </div>
                </details>
            </details>
        </div>
    </div>

    <!-- Actions Footer -->
    <div class="fixed-bottom">
        <div class="actions-grid">
            <button class="btn btn-primary" onclick="sendMessage('refresh')">
                <span class="codicon codicon-sync"></span> Refresh Quotas
            </button>
            <div style="display: flex; gap: 8px;">
                <button class="btn" onclick="sendMessage('mcp')" style="flex: 1;">
                    <span class="codicon codicon-json"></span> MCP
                </button>
                <button class="btn" onclick="sendMessage('reload')" style="flex: 1;">
                    <span class="codicon codicon-refresh"></span> Reload IDE
                </button>
            </div>
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
    </script>
</body>
</html>`;
  }
}
