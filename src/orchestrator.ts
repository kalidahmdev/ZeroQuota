import * as vscode from "vscode";
import { SidecarService } from "./services/sidecarService";
import { StatusBarManager } from "./ui/statusBarManager";

import { DashboardPanel } from "./panels/dashboardPanel";

export class Orchestrator {
  private sidecar: SidecarService;
  private statusBar: StatusBarManager;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(
    private context: vscode.ExtensionContext,
    private dashboard: DashboardPanel,
  ) {
    this.sidecar = new SidecarService(context);
    this.statusBar = new StatusBarManager();
    console.log(
      "[ZeroQuota] Orchestrator initialized with context:",
      this.context.extensionUri.fsPath,
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
    this.statusBar.update(status, false);
    this.dashboard.update(status);
  }

  dispose() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.statusBar.dispose();
  }
}
