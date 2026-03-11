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

  private previousFractions: Record<string, number> = {};

  async refresh() {
    const status = await this.sidecar.fetchUserStatus();
    if (!status) return;

    const notifyOnReset = this.context.globalState.get<boolean>("zeroquota.notifyOnReset", false);

    if (notifyOnReset) {
      let resetDetected = false;
      for (const config of status.modelConfigs) {
        if (!config.quotaInfo) continue;
        
        const label = config.label;
        const frac = config.quotaInfo.remainingFraction;
        const prev = this.previousFractions[label];

        // If it was used (prev < 1.0) and is now fully reset (frac === 1.0)
        if (prev !== undefined && prev < 1.0 && frac === 1.0) {
            resetDetected = true;
        }
        this.previousFractions[label] = frac;
      }

      if (resetDetected) {
          vscode.window.showInformationMessage("Your ZeroQuota models have been fully reset! 🚀");
      }
    }

    // Update UI components
    this.statusBar.update(status);
    this.dashboard.update(status);
  }

  dispose() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.statusBar.dispose();
  }
}
