/**
 * ZeroQuota - Antigravity IDE Extension
 * Copyright (c) 2026 kalidahmdev
 * Licensed under the MIT License
 */

import * as vscode from "vscode";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { Orchestrator } from "./core/orchestrator";


let orchestrator: Orchestrator;

export async function activate(context: vscode.ExtensionContext) {
  console.log("[ZeroQuota] Extension activated in Antigravity IDE");

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
    vscode.commands.registerCommand("zeroquota.openMcpConfig", async () => {
      const globalConfigPath = path.join(os.homedir(), ".gemini", "config", "mcp_config.json");
      const legacyPath = path.join(os.homedir(), ".gemini", "antigravity", "mcp_config.json");

      let targetPath = globalConfigPath;
      if (!fs.existsSync(globalConfigPath) && fs.existsSync(legacyPath)) {
        targetPath = legacyPath;
      } else {
        try {
          const configDir = path.dirname(globalConfigPath);
          if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
          }
          if (!fs.existsSync(globalConfigPath) || fs.statSync(globalConfigPath).size === 0) {
            fs.writeFileSync(
              globalConfigPath,
              JSON.stringify({ mcpServers: {} }, null, 2) + "\n",
              "utf8"
            );
          }
        } catch (err) {
          console.error("[ZeroQuota] Error ensuring MCP config file:", err);
        }
      }

      vscode.commands.executeCommand("vscode.open", vscode.Uri.file(targetPath));
    }),
    vscode.commands.registerCommand("zeroquota.openRules", async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      let targetPath: string | null = null;
      if (workspaceFolders && workspaceFolders.length > 0) {
        const workspaceRules = path.join(workspaceFolders[0].uri.fsPath, "GEMINI.md");
        if (fs.existsSync(workspaceRules)) {
          targetPath = workspaceRules;
        }
      }

      if (!targetPath) {
        const globalRules = path.join(os.homedir(), ".gemini", "GEMINI.md");
        if (fs.existsSync(globalRules)) {
          targetPath = globalRules;
        } else {
          try {
            const dir = path.dirname(globalRules);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(globalRules, "# Antigravity Rules\n\n", "utf8");
            targetPath = globalRules;
          } catch {
            targetPath = globalRules;
          }
        }
      }

      vscode.commands.executeCommand("vscode.open", vscode.Uri.file(targetPath));
    }),
    vscode.commands.registerCommand("zeroquota.openSkills", async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      let targetPath: string | null = null;
      if (workspaceFolders && workspaceFolders.length > 0) {
        const root = workspaceFolders[0].uri.fsPath;
        const candidates = [
          path.join(root, ".agents", "skills"),
          path.join(root, ".agents", "workflows"),
          path.join(root, ".agent", "skills"),
          path.join(root, ".agents"),
        ];
        for (const c of candidates) {
          if (fs.existsSync(c)) {
            targetPath = c;
            break;
          }
        }
      }

      if (!targetPath) {
        const globalSkills = path.join(os.homedir(), ".gemini", "skills");
        const globalWorkflows = path.join(os.homedir(), ".gemini", "workflows");
        if (fs.existsSync(globalSkills)) {
          targetPath = globalSkills;
        } else if (fs.existsSync(globalWorkflows)) {
          targetPath = globalWorkflows;
        } else {
          try {
            if (!fs.existsSync(globalSkills)) fs.mkdirSync(globalSkills, { recursive: true });
            targetPath = globalSkills;
          } catch {
            targetPath = globalSkills;
          }
        }
      }

      vscode.env.openExternal(vscode.Uri.file(targetPath));
    }),
    vscode.commands.registerCommand("zeroquota.openWorkflows", async () => {
      await vscode.commands.executeCommand("zeroquota.openSkills");
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
