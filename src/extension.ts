import * as vscode from "vscode";
import * as os from "os";
import * as path from "path";
import { Orchestrator } from "./orchestrator";


let orchestrator: Orchestrator;

export async function activate(context: vscode.ExtensionContext) {
  console.log("[ZeroQuota] Extension activated");

  orchestrator = new Orchestrator(context);
  await orchestrator.init();

  context.subscriptions.push(
    vscode.commands.registerCommand("zeroquota.refresh", () => {
      orchestrator.refresh();
    }),
    vscode.commands.registerCommand("zeroquota.openBrain", () => {
      const brainPath = path.join(os.homedir(), ".gemini", "antigravity", "brain");
      vscode.env.openExternal(vscode.Uri.file(brainPath));
    }),
    vscode.commands.registerCommand("zeroquota.openMcpConfig", () => {
      const mcpPath = path.join(os.homedir(), ".gemini", "antigravity", "mcp_config.json");
      vscode.commands.executeCommand("vscode.open", vscode.Uri.file(mcpPath));
    }),
    vscode.commands.registerCommand("zeroquota.statusBarAction", async () => {
      await vscode.commands.executeCommand("zeroquota.refresh");
      await vscode.commands.executeCommand("zeroquota.dashboard.focus");
    }),
    vscode.commands.registerCommand("zeroquota.reload", () => {
      vscode.commands.executeCommand("workbench.action.reloadWindow");
    })
  );

  context.subscriptions.push(orchestrator);

  // Initial check for settings changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("zeroquota")) {
        orchestrator.startPolling();
        orchestrator.refresh();
      }
    }),
  );
}

export function deactivate() {
  if (orchestrator) {
    orchestrator.dispose();
  }
}
