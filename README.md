<p align="center">
  <img src="icons/ZeroQuota.svg" width="128" alt="ZeroQuota Logo">
</p>

<h1 align="center">ZeroQuota</h1>

<p align="center">
  <strong>The Ultimate AI Resource Command Center for Antigravity IDE.</strong><br>
  Real-time quota monitoring, automated sidecar discovery, and seamless brain directory management.
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-tech-stack--architecture">Tech Stack</a> •
  <a href="#-configuration--environment-">Configuration</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-design-system">Design System</a> •
  <a href="#-visual-gallery-📸">Gallery</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/VS%20Code-007ACC?style=flat-square&logo=visual-studio-code&logoColor=white" alt="VS Code">
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Axios-5A29E4?style=flat-square&logo=axios&logoColor=white" alt="Axios">
  <img src="https://img.shields.io/badge/Connect%20Protocol-000000?style=flat-square&logo=connect&logoColor=white" alt="Connect Protocol">
</p>

---

## 🚀 Features

ZeroQuota is not just a monitor; it's a mission-critical bridge between your IDE and the Antigravity backend.

### 📊 Real-Time Quota Intelligence
| Feature | Description |
| :--- | :--- |
| **Dynamic Progress Bars** | Visual high-fidelity indicators for Gemini Pro, Gemini Flash, and Claude models. |
| **Reset Forensics** | Precise "Time-to-Ready" calculation showing exactly when your next AI burst is available. |
| **Color-Coded Urgency** | Adaptive UI that shifts from Emerald (Safe) to Amber (Warning) and Crimson (Exhausted). |
| **Credit Matrix** | Granular tracking of both Monthly Prompt Credits and Flow Credits. |

### 🧠 Brain Directory Explorer
| Feature | Description |
| :--- | :--- |
| **Knowledge Tree** | A built-in file explorer for your local `brain` directory, categorized by folders and files. |
| **Deep Integration** | One-click access to open brain-stored context files directly in the active editor. |
| **Auto-Sync** | Periodically refreshes the directory state to ensure you're always viewing the latest knowledge fragments. |

### 🛰️ Sidecar Orchestration
| Feature | Description |
| :--- | :--- |
| **Universal Discovery** | Patent-pending discovery logic that finds the Antigravity Language Server on Windows (WMI) and Posix (ps/lsof). |
| **Secure Handshake** | Automated CSRF token extraction from process command lines for zero-config authentication. |
| **Health Monitoring** | "Waiting for language server..." states with automated fallback and reconnection logic. |

### ⚡ Status Bar Telemetry
| Feature | Description |
| :--- | :--- |
| **Critical Metric** | Hover-accessible summary showing the most critical quota status directly in the VS Code footer. |
| **Actionable Tooltips** | Rich tooltips with quick-links to refresh quotas or open the MCP configuration. |

---

## 🛠️ Tech Stack & Architecture

### Core Philosophy 🏗️
ZeroQuota follows a **Decoupled Orchestrator Pattern**. The `Orchestrator` serves as the central nervous system, managing the lifecycle of services and pushing state updates to the UI layers (Webviews and Status Bar).

### State Management 🧠
Communication with the Antigravity Sidecar is handled via a **Local Loopback RPC** using the Connect Protocol over HTTP. This ensures ultra-low latency and maximum security by never exposing data to the public internet.

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Core Framework** | VS Code Extension Toolkit | Deep IDE integration and API access. |
| **Language** | TypeScript 5.4 | Enterprise-grade type safety and async/await orchestration. |
| **Networking** | Axios + Connect | Robust HTTP client for RPC communication. |
| **Styling** | Vanilla CSS (Modern CSS) | High-performance, low-repaint design system utilizing VS Code tokens. |

---

## 🔑 Configuration & Environment 

| Variable | Description | Default | Required |
| :--- | :--- | :--- | :--- |
| `zeroquota.autoUpdateInterval` | Frequency (in seconds) to poll the Sidecar for quota updates. | `60` | No |

---

## 📂 Project Structure

```text
C:\USERS\KHAAL\DESKTOP\ZEROQUOTA
├── .agent/                 # AI Workflow configurations
├── .vscode/                # Extension development settings
├── icons/                  # High-quality SVG assets for UI
├── src/                    # Source code directory
│   ├── services/           # Backend communication (SidecarService)
│   ├── ui/                 # View providers and UI managers
│   │   ├── dashboardViewProvider.ts
│   │   └── statusBarManager.ts
│   ├── extension.ts        # Entry point
│   └── orchestrator.ts     # Central logic coordinator
├── package.json            # Manifest and dependencies
├── tsconfig.json           # Compiler configuration
└── README.md               # You are here
```

---

## 🚀 API & Interaction

ZeroQuota communicates with the local **Antigravity Language Server (Sidecar)** via a specialized RPC layer.

| Endpoint/Method | Description | Parameters |
| :--- | :--- | :--- |
| `GetUserStatus` | The primary data source. Fetches account tier, credits, and model-specific quotas. | `metadata` (ideName, extName) |
| `Discovery` | Internal logic to find server PID, CSFR token, and extension port. | N/A |

---

## 🎨 Design System

ZeroQuota implements a **"Terminal-Native Premium"** aesthetic. It feels like an integral part of VS Code while providing a distinct, high-end feel.

- **Visual Language**: Modern dark mode with linear emerald gradients.
- **Typography**: Uses `Inter` and `Roboto Mono` via VS Code font inheritance.
- **Micro-animations**: Progress bars feature a subtle outer glow and smooth width transitions.
- **Iconography**: Curated set of `Codicons` and custom branded SVGs (`claude.svg`, `google.svg`).

---

## 🧪 Testing & Quality Assurance 🧪

| Test Type | Tool | Purpose |
| :--- | :--- | :--- |
| **Integration** | @vscode/test-electron | End-to-end verification of extension activation and command registry. |
| **Linting** | ESLint | Strict ruleset for code quality and security (No hardcoded secrets). |
| **Manual** | Extension Host | Real-time debugging and UI verification. |

---

## 🗄️ Data Architecture 🗄️

| Entity | Description | Relationships |
| :--- | :--- | :--- |
| **UserStatus** | The global state of the user account. | Has many `ModelConfigs`. |
| **ModelConfig** | Configuration data for specific AI models. | Contains `QuotaInfo`. |
| **QuotaInfo** | Precise usage metrics and reset timestamps. | Unit of measure for the UI progress bars. |

---

## ⚡ Performance & Optimization ⚡

- **Lazy Discovery**: The Sidecar is only probed during initialization or manual refresh, minimizing CPU cycles.
- **Throttled Polling**: Logic ensures that UI updates never overwhelm the VS Code main thread.
- **Shadow DOM Ready**: Webview delivery is optimized for fast cold-starts.

---

## 📸 Visual Gallery 📸

<p align="center">
  <img src="zeroquota_dashboard_mockup_1773184194720.png" width="600" alt="ZeroQuota Dashboard Mockup">
</p>

---

## 🗺️ Roadmap & Maturity 🗺️

- [x] Sidecar Auto-Discovery (Windows/Unix)
- [x] High-Fidelity Quota Dashboard
- [x] Brain Directory File Explorer
- [x] Interactive Action Footer (MCP/Reload)
- [ ] Multi-Account Support
- [ ] Historical Usage Analytics
- [ ] One-Click Quota Purchase Integration

---

## 📖 Glossary

- **Sidecar**: The local Antigravity Language Server that handles AI logic.
- **Brain**: The local directory storing project-specific knowledge fragments.
- **Connect Protocol**: The high-performance RPC protocol used for inter-process communication.
- **Quota Fraction**: The raw decimal representation of your remaining AI power.

---

<p align="center">
  Built with obsession for the Antigravity Ecosystem.
</p>
