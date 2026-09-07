# Changelog

All notable changes to the **ZeroQuota** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-09-07

### 🚀 Major Milestone & Highlights

ZeroQuota v2.0 brings full **Google Antigravity** support to **VS Code** (via the official Antigravity extension) alongside the standalone **Antigravity IDE**. Now, no matter which editor you use to code with Antigravity, ZeroQuota automatically hooks into your local sidecar to deliver real-time quota telemetry, smart pooling, and productivity tooling.

### Added
- **VS Code + Antigravity IDE Dual Compatibility**:
  - Seamless auto-discovery for both the standalone **Antigravity IDE** (`language_server`) and the official **VS Code Antigravity Extension** (`agy --hub`).
  - Dynamic discovery of listening ports and automatic CSRF token negotiation via Hub endpoints.
  - Multi-protocol fallback (`https` with custom SSL agent and `http`) to ensure reliable local communication across environments.
- **Adaptive Smart-Cascade Polling**:
  - Automatically slows down polling frequency when active Antigravity quotas hit 0% to dramatically conserve battery and CPU resources.
  - Precision stepped wake-up schedule:
    - `> 1 hour`: Polls every 30 minutes.
    - `15m – 60m`: Polls every 10 minutes.
    - `1m – 15m`: Sleeps until right before reset time.
    - `< 1m`: Switches to 15s rapid polling to immediately capture reset.
- **Shared Quota Pool Architecture**:
  - Correctly reflects Antigravity's pooled resource limits:
    - **Gemini Pool**: Aggregates Gemini 3 Pro (High) & Gemini 3 Flash.
    - **Claude Pool**: Aggregates Claude 3.5/3.7 Sonnet & GPT-OSS.
  - Prevents confusing duplicate percentages in the status bar and dashboard.
- **Cascade Trajectory & Session Tracking**:
  - Added support for `GetAllCascadeTrajectories` to inspect active session summaries, step counts, and modification times directly from the dashboard.
- **Proactive Notifications**:
  - Low-quota threshold warning (customizable percentage, latched to prevent spam).
  - Quota reset notification when exhausted quotas are restored to 100%.
- **Antigravity Quick Action Developer Hub**:
  - `zeroquota.openMcpConfig`: Open `~/.gemini/config/mcp_config.json` (auto-scaffolds template if missing).
  - `zeroquota.openRules`: Open workspace or global `GEMINI.md`.
  - `zeroquota.openSkills`: Open workspace `.agents/skills` or global `~/.gemini/skills`.
  - `zeroquota.openWorkflows`: Quick alias for skills navigation.
  - `zeroquota.openBrain`: Open the Antigravity brain directory.
- **Revamped Glassmorphism Dashboard UI**:
  - Modernized dark/light theme-aware design with glowing neon tokens.
  - Interactive quick-settings drawer with backdrop dismissal, keyboard shortcuts (`Esc`), and instant save indicator.
  - Model visibility toggles and refresh rate selectors.
- **Dual Testing Suite**:
  - 39 unit and integration tests passing under Vitest with comprehensive mocks for VS Code, WMI, PowerShell, and sidecar endpoints.

### Changed
- Refactored `Orchestrator` to support dynamic delay rescheduling and state latching for quota warnings.
- Upgraded TypeScript configuration to `Node16` resolution with strict type checks and ES2022 targets.
- Enhanced Status Bar item with user profile pictures, tier badges, and one-click manual refresh.

---

## [1.0.3] - 2026-03-01
### Added
- Dual Mocha and Vitest test runner configuration.
- Shared quota color and emoji utility functions.

---

## [1.0.2] - 2026-02-15
### Added
- Automated sidecar discovery using PowerShell/WMI and POSIX process scanning.
- Initial global status bar indicator.

---

## [1.0.1] - 2026-02-01
### Added
- Initial release with Antigravity IDE sidebar dashboard and basic quota monitoring.
