import * as vscode from "vscode";

export class DashboardPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = "zeroquota.dashboard";
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;
    console.log("[ZeroQuota] Sidebar resolved");

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((data) => {
      switch (data.type) {
        case "refresh":
          vscode.commands.executeCommand("zeroquota.refresh");
          break;
      }
    });
  }

  public update(status: any) {
    if (this._view) {
      this._view.webview.postMessage({ type: "updateStatus", status });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "main.js"),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "main.css"),
    );

    return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUri}" rel="stylesheet">
                <title>ZeroQuota Dashboard</title>
            </head>
            <body>
                <div class="container">
                    <header>
                        <h3>ZeroQuota Dashboard</h3>
                    </header>
                    
                    <section class="quota-section">
                        <h4>Model Quotas</h4>
                        <div id="model-grid" class="quota-grid">
                            <div class="loading">Discovering sidecar...</div>
                        </div>
                    </section>

                    <section class="credits-section">
                        <h4>Monthly Credit Pool</h4>
                        <div class="credit-row">
                            <span style="font-size: 0.8em; opacity: 0.8;">Prompt:</span>
                            <div class="progress-bar"><div id="prompt-bar" class="progress"></div></div>
                            <span id="prompt-text" style="font-size: 0.8em; font-weight: bold;">0/0</span>
                        </div>
                        <div class="credit-row">
                            <span style="font-size: 0.8em; opacity: 0.8;">Flow:</span>
                            <div class="progress-bar"><div id="flow-bar" class="progress"></div></div>
                            <span id="flow-text" style="font-size: 0.8em; font-weight: bold;">0/0</span>
                        </div>
                    </section>

                    <div class="recovery-matrix">
                        <button class="btn primary" onclick="handleAction('restart')">Restart</button>
                        <button class="btn primary" onclick="handleAction('reset')">Reset</button>
                        <button class="btn secondary" onclick="handleAction('reload')">Reload</button>
                    </div>

                    <div class="footer-actions">
                        <button class="btn refresh-btn" onclick="sendMessage('refresh')">Manual Refresh</button>
                    </div>
                </div>
                <script src="${scriptUri}"></script>
            </body>
            </html>`;
  }
}
