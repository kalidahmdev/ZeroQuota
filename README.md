<p align="center">
  <img src="assets/icons/store-logo.png" alt="ZeroQuota Logo" width="160">
</p>

<h1 align="center">ZeroQuota</h1>

<p align="center">
  <strong>The Ultimate AI Quota Telemetry & Terminal Automation Suite for Antigravity IDE.</strong><br>
  <em>Premium monitoring, real-time insights, and zero-config intelligence for the high-performance AI developer.</em>
</p>

<p align="center">
  <a href="#-key-features">Features</a> •
  <a href="#-technical-stack">Tech Stack</a> •
  <a href="#-project-structure">Architecture</a> •
  <a href="#-getting-started">Setup</a> •
  <a href="#-configuration">Config</a> •
  <a href="#-roadmap">Roadmap</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Antigravity%20IDE-ccff00?style=flat-square&logo=google" alt="Antigravity IDE Required">
  <img src="https://img.shields.io/badge/TypeScript-v5.4-3178C6?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License MIT">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" alt="PRs Welcome">
</p>

---

## 🚀 Key Features

ZeroQuota is purpose-built to transform your Antigravity IDE experience with high-fidelity telemetry and seamless process management.

### 📊 Real-Time Telemetry Dashboard
| Feature | Technical Implementation |
| :--- | :--- |
| **Native Integration** | Deeply coupled with the Antigravity Language Server for pinpoint accuracy. |
| **Multi-Model Monitoring** | Live tracking for Gemini 3 Pro, Flash, Claude, and GPT OSS variants. |
| **Visual Sparklines** | Dynamic SVG-rendered usage history representing rolling 5-hour telemetry. |
| **Urgency Indicators** | Intelligent color-mapping (Neon Green → Warning Yellow → Error Red) based on burn rates. |

### 🧠 Brain Hub & Automation
| Feature | Technical Implementation |
| :--- | :--- |
| **Intelligent Discovery** | Automagically detects the Antigravity `language_server` sidecar process and CSRF tokens. |
| **Directory Management** | Integrated search and tree-view navigation for the `~/.gemini/antigravity/brain` registry. |
| **Notification Engine** | Configurable platform alerts for quota low-points and full credit resets. |
| **MCP Quick-Access** | Direct deep-links to Antigravity's Model Context Protocol configuration. |

---

## 🛠️ Technical Stack

### Core Architecture
- **Language**: [TypeScript (Strict Mode)](https://www.typescriptlang.org/)
- **Platform**: [Antigravity IDE Extension Host](https://github.com/google/antigravity)
- **Bundler**: [esbuild](https://esbuild.github.io/) for hyper-fast development and production builds.
- **UI Layer**: Vanilla HTML5/CSS3 with Glassmorphism effects for premium aesthetics.
- **Communication**: Axio-based Connect Protocol implementation for Antigravity-native interaction.

### System Components
| Layer | Responsibility |
| :--- | :--- |
| **`Orchestrator`** | The central brain; manages polling, state synchronization, and UI updates. |
| **`SidecarService`** | Handles low-level process discovery (WMI/PS) and Antigravity port hunting. |
| **`DashboardViewProvider`** | Manages the Sidebar Webview context, CSS Design Tokens, and SVG rendering. |
| **`StatusBarManager`** | High-visibility telemetry indicator with Markdown-supported "Sticky" tooltips. |

---

## ⚙️ Configuration & Environment 🔑

ZeroQuota is designed for both "Zero-Config" usage and expert-level customization within Antigravity.

| Variable | Workspace Setting | Default | Description |
| :--- | :--- | :--- | :--- |
| `autoUpdateInterval` | `zeroquota.autoUpdateInterval` | `60` | Polling frequency in seconds. |
| `notificationThreshold` | `zeroquota.notificationThreshold` | `25` | Percentage trigger for "Low Quota" warnings. |
| `modelPicker` | `zeroquota.modelPicker` | `{all: true}` | Toggle visibility of specific model variants in UI. |
| `refreshRate` | `zeroquota.refreshRate` | `"1m"` | Polling presets: Real-time, 1m, 5m, Manual. |
| `autoSyncBrain` | `zeroquota.autoSyncBrain` | `true` | Periodically scan the Brain Directory for changes. |

---

## 📂 Project Structure

```text
ZeroQuota/
├── assets/
│   ├── brands/           # Optimized SVG logos for Google, Anthropic, OpenAI
│   └── icons/            # Extension-specific brand assets and logo
├── src/
│   ├── core/
│   │   └── orchestrator.ts # logic synchronization hub
│   ├── services/
│   │   └── sidecarService.ts # Process discovery & API layer
│   ├── ui/
│   │   ├── dashboardViewProvider.ts # Sidebar Webview (Glass UI)
│   │   └── statusBarManager.ts # Status bar & Markdown tooltips
│   ├── types/
│   │   └── index.ts      # Shared enterprise type definitions
│   └── extension.ts      # Extension entry-point
├── esbuild.js            # Build & Watch pipeline
└── package.json          # Manifest & Dependencies
```

---

## 🏁 Getting Started

### Prerequisites
- [Antigravity IDE](https://github.com/google/antigravity) (Required for sidecar discovery)
- [Node.js v20+](https://nodejs.org/)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/kalidahmdev/ZeroQuota.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Sidecar Activation:
   - Ensure the Antigravity Language Server is running. ZeroQuota will automatically hunt for the process on startup.

---

## 🧪 Quality & Verification 🧪

| Test Type | Tool | Purpose | Status |
| :--- | :--- | :--- | :--- |
| **Static Analysis** | ESLint | Ensures code quality and type-safety. | Pass |
| **Build Integrity** | TSC / Esbuild | Validates enterprise-grade imports and bundles. | Pass |
| **Discovery Logic** | Process Audit | Verified WMI (Windows) and Netstat/Lsof (Unix) reliability. | Verified |

---

## 🆘 Troubleshooting & FAQ 🆘

| Issue | Symptom | Solution |
| :--- | :--- | :--- |
| **Discovery Failed** | "Could not find active Antigravity Server" | Ensure Antigravity IDE is running; ZeroQuota hunts for the sidecar binary. |
| **No Telemetry** | Status bar shows "Offline" | Check your network or ensure CSRF tokens aren't being blocked by a local firewall. |
| **Icons Missing** | Logo doesn't appear in sidebar | Ensure you haven't moved the `assets` folder; ZeroQuota uses relative paths for resources. |

---

## 🗺️ Roadmap & Maturity

Current Status: **v1.0.0 (Stable / Enterprise Ready)**

- [x] Multi-model quota monitoring
- [X] High-fidelity Sidebar Dashboard
- [x] Automated Sidecar Discovery
- [x] Brand Icon Organization
- [ ] Multi-account switching support
- [ ] Exportable usage reports (CSV/JSON)
- [ ] Custom CSS Themes for Dashboard

---

## 🛡️ Security & Privacy

ZeroQuota respects your privacy and IDE performance:
- **Local-Only Processing**: All telemetry data remains on your machine.
- **Native CSRF Protection**: Utilizes the native Antigravity tokens for all requests.
- **Performance Focused**: Throttled polling ensures zero IDE lag.

---

## 🤝 Contributing & License

We love contributions! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for details.

This project is licensed under the **MIT License**.

Developed with ❤️ for the Antigravity Community by **[@kalidahmdev](https://github.com/kalidahmdev)**.
