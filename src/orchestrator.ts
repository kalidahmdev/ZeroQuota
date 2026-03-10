import * as vscode from "vscode";
import { SidecarService } from "./services/sidecarService";
import { StatusBarManager } from "./ui/statusBarManager";
import { DashboardViewProvider } from "./ui/dashboardViewProvider";



export class Orchestrator {
  private sidecar: SidecarService;
  private statusBar: StatusBarManager;
  private dashboard: DashboardViewProvider;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(
    private context: vscode.ExtensionContext,
  ) {
    this.sidecar = new SidecarService();
    this.statusBar = new StatusBarManager(this.context);
    console.log(
      "[ZeroQuota] Orchestrator initialized with context:",
      this.context.extensionUri.fsPath,
    );

    this.dashboard = new DashboardViewProvider(this.context);
    this.context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        DashboardViewProvider.viewType,
        this.dashboard
      )
    );
  }

  async init() {
    this.startPolling();

    // Initial fetch
    await this.refresh();
  }

  startPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);

    const interval = vscode.workspace
      .getConfiguration("zeroquota")
      .get("autoUpdateInterval", 60);
    this.pollInterval = setInterval(() => this.refresh(), interval * 1000);
  }

  async refresh() {
    const status = await this.sidecar.fetchUserStatus();

    // We pass false for autoAccept state since the feature is removed
    this.statusBar.update(status);
    this.dashboard.update(status);
  }

  dispose() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.statusBar.dispose();
  }
}
