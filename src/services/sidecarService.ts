/**
 * ZeroQuota - Antigravity IDE Extension
 * Copyright (c) 2026 kalidahmdev
 * Licensed under the MIT License
 */

import * as child_process from "child_process";
import * as https from "https";
import axios from "axios";

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

const execAsync = (
  cmd: string,
  options?: child_process.ExecOptions,
): Promise<{ stdout: string; stderr: string }> => {
  return new Promise((resolve, reject) => {
    child_process.exec(
      cmd,
      options,
      (
        error: child_process.ExecException | null,
        stdout: string | Buffer,
        stderr: string | Buffer,
      ) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            stdout: typeof stdout === "string" ? stdout : stdout.toString(),
            stderr: typeof stderr === "string" ? stderr : stderr.toString(),
          });
        }
      },
    );
  });
};

import { UserStatus, TrajectoryInfo } from "../types";

interface RawModelConfig {
  label?: string;
  modelOrAlias?: {
    model?: string;
    alias?: string;
  };
  quotaInfo?: {
    remainingFraction?: number;
    resetTime?: string;
  };
}

interface RawUserStatusResponse {
  userStatus?: {
    name?: string;
    email?: string;
    profilePictureUrl?: string;
    userTier?: {
      name?: string;
    };
    cascadeModelConfigData?: {
      clientModelConfigs?: RawModelConfig[];
      defaultOverrideModelConfig?: {
        modelOrAlias?: {
          model?: string;
          alias?: string;
        };
      };
    };
    modelConfigs?: RawModelConfig[];
    planStatus?: {
      availablePromptCredits?: number;
      availableFlowCredits?: number;
      planInfo?: {
        monthlyPromptCredits?: number;
        monthlyFlowCredits?: number;
      };
    };
  };
}

export class SidecarService {
  constructor() {}

  private async fetchCsrfTokenFromHub(port: string): Promise<string | undefined> {
    try {
      const response = await axios.get(`http://127.0.0.1:${port}/`, {
        timeout: 2000,
        responseType: "text",
      });
      const content =
        typeof response.data === "string"
          ? response.data
          : JSON.stringify(response.data);
      const match = content.match(/"csrfToken"\s*:\s*"([^"]+)"/);
      return match ? match[1] : undefined;
    } catch {
      return undefined;
    }
  }

  private async discoverServer(): Promise<{
    pid: string;
    token: string;
    port?: string;
  } | null> {
    try {
      const isWin = process.platform === "win32";
      const candidateProcesses: Array<{ pid: string; cmdline: string }> = [];

      if (isWin) {
        const cmd = `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { Get-CimInstance Win32_Process -Filter \\"name LIKE 'language_server%' OR name LIKE 'agy%'\\" | Select-Object ProcessId, CommandLine | ConvertTo-Json } catch { Get-WmiObject Win32_Process -Filter \\"name LIKE 'language_server%' OR name LIKE 'agy%'\\" | Select-Object ProcessId, CommandLine | ConvertTo-Json }"`;
        const { stdout } = await execAsync(cmd);
        if (stdout.trim()) {
          const parsed = JSON.parse(stdout);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of list) {
            if (item && item.ProcessId && item.CommandLine) {
              candidateProcesses.push({
                pid: String(item.ProcessId),
                cmdline: String(item.CommandLine),
              });
            }
          }
        }
      } else {
        const { stdout } = await execAsync("ps aux");
        for (const line of stdout.split("\n")) {
          if (
            (line.includes("language_server") && line.includes("--csrf_token")) ||
            (line.includes("agy") && line.includes("--hub"))
          ) {
            const parts = line.trim().split(/\s+/);
            if (parts.length > 1) {
              const pid = parts[1];
              const baseIdx = parts.length > 10 ? 10 : 1;
              const cmdline = parts.slice(baseIdx).join(" ");
              candidateProcesses.push({ pid, cmdline });
            }
          }
        }
      }

      if (candidateProcesses.length === 0) return null;

      for (const candidate of candidateProcesses) {
        const { pid, cmdline } = candidate;

        // Check for VS Code Antigravity Extension (agy --hub)
        const isAgyHub = cmdline.includes("agy") || cmdline.includes("--hub");

        if (isAgyHub) {
          const hubPortMatch = cmdline.match(/--hub-port[=\s]+(\d+)/);
          let port = hubPortMatch ? hubPortMatch[1] : undefined;

          if (!port) {
            const listeningPorts = await this.getListeningPorts(pid, isWin);
            port = listeningPorts[0];
          }

          if (port) {
            const token = await this.fetchCsrfTokenFromHub(port);
            if (token) {
              return { pid, token, port };
            }
          }
        }

        // Check for Antigravity IDE (language_server)
        const tokenMatch = cmdline.match(/--csrf_token[=\s]+([0-9a-fA-Za-z-]+)/);
        const portMatch = cmdline.match(/--extension_server_port[=\s]+(\d+)/);

        const token = tokenMatch ? tokenMatch[1] : undefined;
        const port = portMatch ? portMatch[1] : undefined;

        if (token) {
          return { pid, token, port };
        }
      }

      return null;
    } catch (error) {
      console.error("[ZeroQuota] Discovery error:", error);
      return null;
    }
  }

  private async getListeningPorts(
    pid: string,
    isWin: boolean,
  ): Promise<string[]> {
    const ports = new Set<string>();
    try {
      if (isWin) {
        const { stdout } = await execAsync("netstat -ano");
        const pattern = new RegExp(
          `TCP\\s+(?:127\\.0\\.0\\.1|0\\.0\\.0\\.0):(\\d+)\\s+.*\\s+LISTENING\\s+${pid}`,
          "g",
        );
        let match;
        while ((match = pattern.exec(stdout)) !== null) {
          ports.add(match[1]);
        }
      } else {
        try {
          const { stdout } = await execAsync(`lsof -i -P -n -a -p ${pid}`);
          for (const line of stdout.split("\n")) {
            if (line.includes("LISTEN")) {
              const match = line.match(/:(\d+)\s+/);
              if (match) ports.add(match[1]);
            }
          }
        } catch {
          const { stdout } = await execAsync("netstat -tunlp");
          const pattern = new RegExp(`:(\d+)\s+.*\s+${pid}/`, "g");
          let match;
          while ((match = pattern.exec(stdout)) !== null) {
            ports.add(match[1]);
          }
        }
      }
    } catch (error) {
      console.error("[ZeroQuota] Port extraction error:", error);
    }
    return Array.from(ports);
  }

  private lastWorkingServer: { port: string; token: string; protocol: string } | null = null;

  private async fetchStatusFromPort(
    port: string,
    token: string,
  ): Promise<{ data: RawUserStatusResponse; protocol: string } | null> {
    const protocols = ["http", "https"];
    for (const protocol of protocols) {
      const url = `${protocol}://127.0.0.1:${port}/exa.language_server_pb.LanguageServerService/GetUserStatus`;
      try {
        const response = await axios.post<RawUserStatusResponse>(
          url,
          {
            metadata: {
              ideName: "antigravity",
              extensionName: "antigravity",
              locale: "en",
            },
          },
          {
            headers: {
              "Content-Type": "application/json",
              "Connect-Protocol-Version": "1",
              "X-Codeium-Csrf-Token": token,
            },
            httpsAgent,
            timeout: 3000,
          },
        );
        if (response.data && response.data.userStatus) {
          return { data: response.data, protocol };
        }
      } catch {
        // continue to next protocol
      }
    }
    return null;
  }

  async fetchUserStatus(): Promise<UserStatus | null> {
    try {
      const serverInfo = await this.discoverServer();
      if (!serverInfo) {
        console.error(
          "[ZeroQuota] Could not find active Antigravity Language Server.",
        );
        return null;
      }

      const ports: string[] = [];
      if (serverInfo.port) ports.push(serverInfo.port);

      const isWin = process.platform === "win32";
      const listeningPorts = await this.getListeningPorts(
        serverInfo.pid,
        isWin,
      );
      for (const p of listeningPorts) {
        if (!ports.includes(p)) ports.push(p);
      }

      let data: RawUserStatusResponse | null = null;
      for (const port of ports) {
        const res = await this.fetchStatusFromPort(port, serverInfo.token);
        if (res && res.data && res.data.userStatus) {
          data = res.data;
          this.lastWorkingServer = {
            port,
            token: serverInfo.token,
            protocol: res.protocol,
          };
          break;
        }
      }

      if (!data || !data.userStatus) return null;

      const status = data.userStatus;
      const cascade = status.cascadeModelConfigData || {};
      const configs: RawModelConfig[] =
        cascade.clientModelConfigs || status.modelConfigs || [];
      const plan = status.planStatus || {};
      const info = plan.planInfo || {};

      let activeModel: string | undefined;
      let activeModelLabel: string | undefined;
      const override = cascade.defaultOverrideModelConfig?.modelOrAlias;
      if (override) {
        const targetModel = override.model || override.alias;
        if (targetModel) {
          activeModel = targetModel;
          const matched = configs.find(
            (c) =>
              c.modelOrAlias?.model === targetModel ||
              c.modelOrAlias?.alias === targetModel,
          );
          if (matched && matched.label) {
            activeModelLabel = matched.label;
          }
        }
      }

      return {
        name: status.name,
        email: status.email || "Unknown",
        tier: status.userTier?.name || "N/A",
        profilePictureUrl: status.profilePictureUrl,
        activeModel,
        activeModelLabel,
        modelConfigs: configs.map((c: RawModelConfig) => ({
          label: c.label || "",
          quotaInfo: c.quotaInfo
            ? {
                remainingFraction: c.quotaInfo.remainingFraction ?? 0,
                resetTime: c.quotaInfo.resetTime,
              }
            : undefined,
        })),
        promptCredits: Number(info.monthlyPromptCredits || 0),
        availablePromptCredits: Number(plan.availablePromptCredits || 0),
        flowCredits: Number(info.monthlyFlowCredits || 0),
        availableFlowCredits: Number(plan.availableFlowCredits || 0),
      };
    } catch (error) {
      console.error("[ZeroQuota] Service error:", error);
      return null;
    }
  }

  async fetchTrajectories(): Promise<Record<string, TrajectoryInfo> | null> {
    try {
      let serverInfo = this.lastWorkingServer;
      if (!serverInfo) {
        const discovered = await this.discoverServer();
        if (!discovered) return null;
        const ports: string[] = [];
        if (discovered.port) ports.push(discovered.port);
        const isWin = process.platform === "win32";
        const listening = await this.getListeningPorts(discovered.pid, isWin);
        for (const p of listening) {
          if (!ports.includes(p)) ports.push(p);
        }
        for (const port of ports) {
          const res = await this.fetchStatusFromPort(port, discovered.token);
          if (res) {
            this.lastWorkingServer = {
              port,
              token: discovered.token,
              protocol: res.protocol,
            };
            serverInfo = this.lastWorkingServer;
            break;
          }
        }
      }

      if (!serverInfo) return null;

      const url = `${serverInfo.protocol}://127.0.0.1:${serverInfo.port}/exa.language_server_pb.LanguageServerService/GetAllCascadeTrajectories`;
      const response = await axios.post<{
        trajectorySummaries?: Record<
          string,
          { summary?: string; stepCount?: number; lastModifiedTime?: string }
        >;
      }>(
        url,
        {
          metadata: {
            ideName: "antigravity",
            extensionName: "antigravity",
            locale: "en",
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            "Connect-Protocol-Version": "1",
            "X-Codeium-Csrf-Token": serverInfo.token,
          },
          httpsAgent,
          timeout: 3000,
        },
      );

      if (response.data && response.data.trajectorySummaries) {
        const summaries = response.data.trajectorySummaries;
        const result: Record<string, TrajectoryInfo> = {};
        for (const [id, item] of Object.entries(summaries)) {
          if (item && item.summary) {
            result[id] = {
              summary: item.summary,
              stepCount: Number(item.stepCount || 0),
              lastModifiedTime: item.lastModifiedTime,
            };
          }
        }
        return result;
      }
      return null;
    } catch {
      return null;
    }
  }
}
