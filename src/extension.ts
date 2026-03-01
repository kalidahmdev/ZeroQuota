import * as vscode from "vscode";
import { Orchestrator } from "./orchestrator";
import { DashboardPanel } from "./panels/dashboardPanel";

let orchestrator: Orchestrator;

export async function activate(context: vscode.ExtensionContext) {
  console.log("[ZeroQuota] Extension activated");

  const dashboardProvider = new DashboardPanel(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      DashboardPanel.viewType,
      dashboardProvider,
    ),
  );

  orchestrator = new Orchestrator(context, dashboardProvider);
  await orchestrator.init();

  context.subscriptions.push(
    vscode.commands.registerCommand("zeroquota.refresh", () => {
      orchestrator.refresh();
    }),
  );

  context.subscriptions.push(orchestrator);

  // Initial check for settings changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("zeroquota.autoUpdateInterval")) {
        orchestrator.startPolling();
      }
    }),
  );
}

export function deactivate() {
  if (orchestrator) {
    orchestrator.dispose();
  }
}
