<p align="center">
  <img src="assets/icons/store-logo.png" alt="ZeroQuota Logo" width="160">
</p>

<h1 align="center">ZeroQuota v2.0</h1>

<p align="center">
  <strong>The Essential AI Quota Monitoring, Telemetry & Workspace Suite for Google Antigravity.</strong><br>
  <em>Built specifically for Antigravity — now working seamlessly whether you code in the Antigravity IDE or in VS Code with the Antigravity extension.</em>
</p>

<p align="center">
  <a href="#-whats-new-in-v20">What's New in v2.0</a> •
  <a href="#-key-features">Key Features</a> •
  <a href="#-configuration">Configuration</a> •
  <a href="#-commands">Commands</a> •
  <a href="#-how-it-works">How It Works</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-testing">Testing</a>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=ZeroQuota.zeroquota">
    <img src="https://img.shields.io/badge/Visual%20Studio%20Marketplace-Download-007ACC?style=flat-square&logo=visualstudiocode&logoColor=white" alt="Download on Visual Studio Marketplace">
  </a>
  <a href="https://open-vsx.org/extension/ZeroQuota/zeroquota">
    <img src="https://img.shields.io/badge/Open%20VSX-Download-7B1FA2?style=flat-square&logo=eclipseide&logoColor=white" alt="Download on Open VSX">
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-2.0.0-blue?style=flat-square" alt="Version 2.0.0">
  <img src="https://img.shields.io/badge/Built%20For-Google%20Antigravity-ccff00?style=flat-square&logo=google&logoColor=black" alt="Google Antigravity">
  <img src="https://img.shields.io/badge/Runs%20In-VS%20Code%20%7C%20Antigravity%20IDE-23272E?style=flat-square&logo=visualstudiocode" alt="VS Code & Antigravity IDE">
  <img src="https://img.shields.io/badge/TypeScript-v5.4-3178C6?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License MIT">
</p>

<p align="center">
  <img src="assets/screenshots/preview.jpg" alt="ZeroQuota Preview" width="800">
</p>

---

## 🌟 What's New in v2.0 (Major Release)

ZeroQuota is built specifically for **Google Antigravity**. With the release of the official Antigravity extension for VS Code (`agy`), developers can now use Antigravity inside standard VS Code as well as inside the standalone Antigravity IDE.

**ZeroQuota v2.0 brings full compatibility to both environments**: whether you are running the standalone Antigravity IDE or working in VS Code with the Antigravity extension installed, ZeroQuota automatically hooks into your local Antigravity sidecar service without any manual setup.

### Major Highlights:
- 🚀 **VS Code + Antigravity IDE Dual Compatibility**: ZeroQuota auto-detects Antigravity whether it's running via the standalone IDE (`language_server`) or the VS Code Antigravity Extension (`agy --hub`).
- ⚡ **Adaptive Smart-Cascade Polling**: When your Antigravity quotas are depleted (0%), ZeroQuota shifts into smart sleep mode and wakes up right at the reset time, preserving CPU and laptop battery.
- 🎯 **Accurate Shared Quota Pools**: Matches Antigravity's real-world quota allocation:
  - **Gemini Pool**: Gemini 3 Pro (High) & Gemini 3 Flash.
  - **Claude Pool**: Claude 3.5/3.7 Sonnet & GPT-OSS.
- 📜 **Cascade Trajectory & Session Tracking**: Monitor active Cascade trajectories, session step counts, and last modified timestamps right from the sidebar dashboard.
- 🔔 **Proactive Notifications**: Set custom quota thresholds (e.g. 25%, 15%, 5%) for low-quota alerts, plus celebration notifications when quotas reset to 100%.
- 🧰 **Antigravity Quick Action Hub**: One-click access to MCP config (`mcp_config.json` with auto-scaffolding), Rules (`GEMINI.md`), Agent Skills (`.agents/skills`), and Brain storage (`~/.gemini/antigravity/brain`).
- 🎨 **Revamped Glassmorphism Dashboard**: Modern theme-aware tokens, responsive quick-settings drawer (`Esc` to close), neon percentage rings, and brand badges.

---

## 🚀 Key Features

### 📊 Antigravity Quota Telemetry & Pool Intelligence

| Feature | Description |
| :--- | :--- |
| **Real-Time Antigravity Tracking** | Tracks all models available under Antigravity: Gemini 3 Pro, Gemini Flash, Claude Sonnet, and GPT-OSS. |
| **Shared Quota Pool Modeling** | Reflects Antigravity's shared pools so you see unified limits rather than redundant or contradictory figures. |
| **Status Bar Monitor** | Compact status bar metrics with dynamic color-coded urgency emojis (`🟢` `🟡` `🔴`) and countdown timers. |
| **Interactive Tooltip Card** | Hover over the status bar item to view your account profile picture, user tier, remaining model percentages, and reset countdowns. |
| **One-Click Refresh** | Click the status bar or dashboard refresh button for an instant quota update. |

### ⚡ Smart Polling & Battery Optimization

| Feature | Description |
| :--- | :--- |
| **Configurable Frequencies** | Choose between `Real-time (10s)`, `1m`, `5m`, or `Manual` polling. |
| **Adaptive Smart Cascade** | When all active quotas hit 0%, ZeroQuota automatically reduces polling frequency and schedules precision wake-ups near reset time. |
| **Anti-Spam Thresholds** | Quota warning alerts fire once per threshold crossing and latch until quotas recover. |

### 🧠 Antigravity Workspace Tools & Quick Actions

| Tool | Action & Shortcut |
| :--- | :--- |
| **MCP Config Hub** | Opens `~/.gemini/config/mcp_config.json` (or legacy path), automatically creating directory and starter config if absent. |
| **Rules Editor** | Opens workspace `GEMINI.md` or global `~/.gemini/GEMINI.md` to quickly configure agent rules. |
| **Skills & Workflows** | Fast navigation to `.agents/skills`, `.agents/workflows`, or global `~/.gemini/skills`. |
| **Brain Inspector** | Direct access to the local Antigravity brain directory (`~/.gemini/antigravity/brain`). |
| **Session Trajectories** | Inspect recent Antigravity Cascade trajectories with step counts and timestamps. |

---

## ⚙️ Configuration

Configure ZeroQuota via Settings (`Ctrl+,` / `Cmd+,` searching for `ZeroQuota`), or use the **in-dashboard Quick Settings drawer**:

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `zeroquota.refreshRate` | `string` | `"1m"` | Polling frequency (`"Real-time"`, `"1m"`, `"5m"`, `"Manual"`). |
| `zeroquota.adaptivePolling` | `boolean` | `true` | Throttles polling when quotas are at 0% and wakes up at reset time to save CPU & battery. |
| `zeroquota.notificationThreshold` | `integer` | `25` | Percentage threshold to trigger low-quota warning notifications (e.g. 5, 10, 15, 25, 50). |
| `zeroquota.notifyOnReset` | `boolean` | `false` | Shows desktop notification when Antigravity AI quotas recover to 100%. |
| `zeroquota.modelPicker` | `object` | `{...}` | Toggle individual model groups (`geminiPro`, `geminiFlash`, `claude`, `gptOss`). |
| `zeroquota.autoSyncBrain` | `boolean` | `true` | Periodically check the local Brain Directory for changes. |

---

## ⌨️ Commands

| Command | Title | Purpose |
| :--- | :--- | :--- |
| `zeroquota.refresh` | `ZeroQuota: Refresh Quota` | Force an immediate poll and refresh all UI components. |
| `zeroquota.openMcpConfig` | `ZeroQuota: Open MCP Config` | Open `mcp_config.json` with auto-creation. |
| `zeroquota.openRules` | `ZeroQuota: Open Rules (GEMINI.md)` | Open workspace or global Antigravity rules. |
| `zeroquota.openSkills` | `ZeroQuota: Open Antigravity Skills` | Open project or global agent skills directory. |
| `zeroquota.openWorkflows` | `ZeroQuota: Open Workflows (Legacy)` | Backwards-compatible alias for agent skills. |
| `zeroquota.openBrain` | `ZeroQuota: Open Brain Folder` | Open the Antigravity local brain cache folder. |

---

## 🛠️ How It Works

ZeroQuota communicates directly with the local Antigravity sidecar via gRPC-web / Connect-Protocol without requiring any external cloud proxy or personal API keys.

```text
┌────────────────────────────────────────────────────────┐
│                   ZeroQuota v2.0                       │
│      (Sidebar Webview + Status Bar + Orchestrator)     │
└───────────────────────────┬────────────────────────────┘
                            │
               Antigravity Auto-Discovery
             (WMI / PowerShell / POSIX ps)
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
  [ Antigravity IDE ]             [ VS Code Extension ]
  language_server binary          agy --hub process
  --csrf_token / --port           --hub-port / Hub Token
            │                               │
            └───────────────┬───────────────┘
                            ▼
     Connect-Protocol / LanguageServerService
     • GetUserStatus (Quotas, Tier, Account)
     • GetAllCascadeTrajectories (Recent Sessions)
```

- **In Antigravity IDE**: ZeroQuota detects the running `language_server` process, extracts its CSRF token and port, and connects locally.
- **In VS Code**: ZeroQuota detects the Antigravity extension's background process (`agy --hub`), retrieves the listening port and token from the hub endpoint, and seamlessly binds to the service.

---

## 🏁 Getting Started

### Prerequisites
- Google Antigravity installed:
  - Either the standalone **Antigravity IDE**
  - OR **VS Code v1.90+** with the official Antigravity Extension.
- [Node.js v20+](https://nodejs.org/) (for development only).

### Installation

#### From VS Code Marketplace or Open VSX:

[![Install from VS Code Marketplace](https://img.shields.io/badge/Visual%20Studio%20Marketplace-Install-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=ZeroQuota.zeroquota)
[![Install from Open VSX](https://img.shields.io/badge/Open%20VSX-Install-7B1FA2?style=for-the-badge&logo=eclipseide&logoColor=white)](https://open-vsx.org/extension/ZeroQuota/zeroquota)

1. Or search for **ZeroQuota** in your Extensions tab (`Ctrl+Shift+X` / `Cmd+Shift+X`).
2. Click **Install**.
3. ZeroQuota will automatically activate and start monitoring your Antigravity quotas.

#### From VSIX:
1. Download `zeroquota-2.0.0.vsix` from the [Releases](https://github.com/kalidahmdev/ZeroQuota/releases) page.
2. In VS Code or Antigravity IDE, press `Ctrl+Shift+P` and choose **Extensions: Install from VSIX...**
3. Select the `.vsix` file.

---

## 🧪 Testing & Quality Assurance

ZeroQuota includes an automated dual test suite with 39 tests covering all orchestrator states, process discovery, sidecar communication, and status bar logic:

```bash
# Run unit & integration tests with linting and compilation
npm run test:full

# Run tests with vitest
npm test
```

---

## 📜 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more details.

Crafted with ❤️ for the Antigravity community by **[@kalidahmdev](https://github.com/kalidahmdev)**.
