/**
 * ZeroQuota - Antigravity IDE Extension
 * Copyright (c) 2026 kalidahmdev
 * Licensed under the MIT License
 */

import { exec } from "child_process";
import { promisify } from "util";
import axios from "axios";

const execAsync = promisify(exec);

import { UserStatus } from "../types";


export class SidecarService {
  constructor() {}

  private async discoverServer(): Promise<{
    pid: string;
    token: string;
    port?: string;
  } | null> {
    try {
      const isWin = process.platform === "win32";
      let pid: string | undefined;
      let cmdline: string | undefined;

      if (isWin) {
        const cmd = `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-WmiObject Win32_Process -Filter \\"name LIKE 'language_server_windows_%'\\" | Select-Object ProcessId, CommandLine | ConvertTo-Json"`;
        const { stdout } = await execAsync(cmd);
        if (!stdout.trim()) return null;

        const data = JSON.parse(stdout);
        const processData = Array.isArray(data) ? data[0] : data;
        pid = String(processData.ProcessId);
        cmdline = processData.CommandLine;
      } else {
        const { stdout } = await execAsync("ps aux");
        for (const line of stdout.split("\n")) {
          if (
            line.includes("language_server_") &&
            line.includes("--csrf_token")
          ) {
            const parts = line.trim().split(/\s+/);
            if (parts.length > 1) {
              pid = parts[1];
              const baseIdx = parts.length > 10 ? 10 : 1;
              cmdline = parts.slice(baseIdx).join(" ");
              break;
            }
          }
        }
      }

      if (!pid || !cmdline) return null;

      const tokenMatch = cmdline.match(/--csrf_token\s+([0-9a-f-]+)/);
      const portMatch = cmdline.match(/--extension_server_port\s+(\d+)/);

      const token = tokenMatch ? tokenMatch[1] : undefined;
      const port = portMatch ? portMatch[1] : undefined;

      if (!token) return null;

      return { pid, token, port };
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

  private async fetchStatusFromPort(port: string, token: string): Promise<any> {
    const url = `http://127.0.0.1:${port}/exa.language_server_pb.LanguageServerService/GetUserStatus`;
    try {
      const response = await axios.post(
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
          timeout: 3000,
        },
      );
      return response.data;
    } catch {
      return null;
    }
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

      let data: any = null;
      for (const port of ports) {
        const res = await this.fetchStatusFromPort(port, serverInfo.token);
        if (res && res.userStatus) {
          data = res;
          break;
        }
      }

      if (!data || !data.userStatus) return null;

      const status = data.userStatus;
      const cascade = status.cascadeModelConfigData || {};
      const configs = cascade.clientModelConfigs || [];
      const plan = status.planStatus || {};
      const info = plan.planInfo || {};

      return {
        email: status.email || "Unknown",
        tier: status.userTier?.name || "N/A",
        modelConfigs: configs.map((c: any) => ({
          label: c.label,
          quotaInfo: c.quotaInfo
            ? {
                remainingFraction: c.quotaInfo.remainingFraction,
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
}
