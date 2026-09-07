/**
 * ZeroQuota - Antigravity IDE Extension
 * Copyright (c) 2026 kalidahmdev
 * Licensed under the MIT License
 */

import * as vscode from "vscode";
import { SidecarService } from "../services/sidecarService";
import { StatusBarManager } from "../ui/statusBarManager";
import { DashboardViewProvider } from "../ui/dashboardViewProvider";
import { TrajectoryInfo, UserStatus, ModelPickerConfig } from "../types";



export class Orchestrator {
  private sidecar: SidecarService;
  private statusBar: StatusBarManager;
  private dashboard: DashboardViewProvider;
  private pollInterval: NodeJS.Timeout | null = null;
  private previousFractions: Record<string, number> = {};
  private warnedModels: Record<string, boolean> = {};

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
    this.scheduleNextPoll();
  }

  public scheduleNextPoll(overrideDelayMs?: number) {
    if (this.pollInterval) {
      clearTimeout(this.pollInterval);
      this.pollInterval = null;
    }

    const config = vscode.workspace.getConfiguration("zeroquota");
    const refreshRate = config.get<string>("refreshRate", "1m");
    let intervalSeconds: number;

    switch (refreshRate) {
      case "Real-time":
        intervalSeconds = 10;
        break;
      case "1m":
        intervalSeconds = 60;
        break;
      case "5m":
        intervalSeconds = 300;
        break;
      case "Manual":
        intervalSeconds = 0;
        break;
      default:
        intervalSeconds = config.get<number>("autoUpdateInterval", 60);
        break;
    }

    if (intervalSeconds <= 0) {
      return;
    }

    const delayMs = overrideDelayMs !== undefined ? overrideDelayMs : intervalSeconds * 1000;
    this.pollInterval = setTimeout(async () => {
      await this.refresh();
    }, delayMs);
  }

  public calculateNextDelay(status: UserStatus | null): number | undefined {
    if (!status) return undefined;

    const config = vscode.workspace.getConfiguration("zeroquota");
    const adaptivePolling = config.get<boolean>("adaptivePolling", true);
    if (!adaptivePolling) return undefined;

    const modelPicker = config.get<ModelPickerConfig>("modelPicker", {
      geminiPro: true,
      geminiFlash: true,
      claude: true,
      gptOss: true,
    });

    // Determine tracked models that have quotaInfo
    const trackedModels = status.modelConfigs.filter((m) => {
      if (!m.quotaInfo) return false;
      if (m.label.includes("Gemini") && m.label.includes("Pro") && modelPicker?.geminiPro === false) return false;
      if (m.label.includes("Gemini") && m.label.includes("Flash") && modelPicker?.geminiFlash === false) return false;
      if (m.label.includes("Claude") && modelPicker?.claude === false) return false;
      if (m.label.toLowerCase().includes("gpt") && modelPicker?.gptOss === false) return false;
      return true;
    });

    if (trackedModels.length === 0) return undefined;

    // Check if ALL tracked models are at 0% (or <= 0.001)
    const allExhausted = trackedModels.every((m) => {
      const frac = m.quotaInfo?.remainingFraction ?? 1;
      return frac <= 0.001;
    });

    if (!allExhausted) {
      // User still has usage remaining on at least one model -> normal rate
      return undefined;
    }

    // All active models are 0%: Find earliest resetTime
    let earliestResetMs: number | null = null;
    const now = Date.now();

    for (const m of trackedModels) {
      const resetStr = m.quotaInfo?.resetTime;
      if (!resetStr) continue;
      const resetDate = new Date(resetStr);
      const diffMs = resetDate.getTime() - now;
      if (diffMs > 0) {
        if (earliestResetMs === null || diffMs < earliestResetMs) {
          earliestResetMs = diffMs;
        }
      }
    }

    if (earliestResetMs === null) {
      return undefined;
    }

    // Precision stepped cascade:
    // 1. Over 1 hour: poll every 30 minutes
    if (earliestResetMs > 60 * 60 * 1000) {
      return 30 * 60 * 1000;
    }
    // 2. 15 to 60 minutes: poll every 10 minutes
    if (earliestResetMs > 15 * 60 * 1000) {
      return 10 * 60 * 1000;
    }
    // 3. 1 to 15 minutes: wake up at reset time (or within 60s)
    if (earliestResetMs > 60 * 1000) {
      return Math.min(earliestResetMs + 2000, 60 * 1000);
    }
    // 4. <= 1 minute or past due: poll every 15s to detect reset immediately
    return 15 * 1000;
  }

  async refresh() {
    const status = await this.sidecar.fetchUserStatus();
    if (!status) {
      this.scheduleNextPoll();
      return;
    }

    const config = vscode.workspace.getConfiguration("zeroquota");
    const notifyOnReset =
      config.get<boolean>("notifyOnReset") ??
      this.context.globalState.get<boolean>("zeroquota.notifyOnReset", false);

    let resetDetected = false;
    for (const modelConfig of status.modelConfigs) {
      if (!modelConfig.quotaInfo) continue;

      const label = modelConfig.label;
      const bFrac = modelConfig.quotaInfo.remainingFraction;
      const frac = isNaN(bFrac) ? 0 : bFrac;
      const prev = this.previousFractions[label];

      // If it was used (prev < 1.0) and is now fully reset (frac === 1.0)
      if (prev !== undefined && prev < 1.0 && frac === 1.0) {
        resetDetected = true;
      }
      this.previousFractions[label] = frac;
    }

    if (notifyOnReset && resetDetected) {
      vscode.window.showInformationMessage(
        "Your ZeroQuota models have been fully reset! 🚀",
      );
    }

    // Quota low-warning notification
    const thresholdSetting =
      config.get<number>("notificationThreshold") ??
      Number(this.context.globalState.get("zeroquota.notificationThreshold", 25));
    const threshold =
      typeof thresholdSetting === "number"
        ? thresholdSetting
        : Number(thresholdSetting);

    if (!isNaN(threshold) && threshold > 0) {
      for (const modelConfig of status.modelConfigs) {
        if (!modelConfig.quotaInfo) continue;

        const label = modelConfig.label;
        const bFrac = modelConfig.quotaInfo.remainingFraction;
        const frac = isNaN(bFrac) ? 0 : bFrac;
        const pct = Math.round(frac * 100);

        if (pct <= threshold) {
          if (!this.warnedModels[label]) {
            this.warnedModels[label] = true;
            vscode.window.showWarningMessage(
              `⚠️ ZeroQuota: ${label} quota is low (${pct}% remaining)!`,
            );
          }
        } else {
          // Reset warning state once quota recovers above threshold
          this.warnedModels[label] = false;
        }
      }
    }

    // Update UI components
    this.statusBar.update(status);

    let trajectories: Record<string, TrajectoryInfo> | null = null;
    if (typeof this.sidecar.fetchTrajectories === "function") {
      try {
        trajectories = await this.sidecar.fetchTrajectories();
      } catch {
        trajectories = null;
      }
    }
    this.dashboard.update(status, trajectories);

    // Schedule next poll based on remaining quota and reset timing
    const nextDelay = this.calculateNextDelay(status);
    this.scheduleNextPoll(nextDelay);
  }

  dispose() {
    if (this.pollInterval) {
      clearTimeout(this.pollInterval);
      this.pollInterval = null;
    }
    this.statusBar.dispose();
  }
}
