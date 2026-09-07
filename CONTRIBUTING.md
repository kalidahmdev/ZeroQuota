# Contributing to ZeroQuota

Thank you for your interest in contributing to ZeroQuota! We welcome contributions from the community.

ZeroQuota is built specifically for **Google Antigravity**, providing telemetry, quota monitoring, and productivity tools across both the standalone **Antigravity IDE** and **VS Code** (with the Antigravity extension).

---

## 🛠️ How to Contribute

### Reporting Bugs
- Check the [existing issues](https://github.com/kalidahmdev/ZeroQuota/issues) to avoid duplicates.
- Use the **Bug Report** template when opening an issue.
- Please include your environment details (VS Code / Antigravity IDE version, ZeroQuota version, OS).
- Provide clear steps to reproduce and relevant logs.

### Suggesting Features
- Use the **Feature Request** template on [GitHub Issues](https://github.com/kalidahmdev/ZeroQuota/issues).
- Detail why the feature would be beneficial and how it fits within the Antigravity ecosystem.

### Pull Requests
1. Fork the repository and create a feature branch (`git checkout -b feature/amazing-feature`).
2. Make your changes with clean, well-documented TypeScript code.
3. Ensure all tests pass and code conforms to linting standards:
   ```bash
   npm run test:full
   ```
4. Commit your changes using conventional commit messages (`git commit -m 'feat: add support for xyz'`).
5. Push to your fork and submit a Pull Request describing your changes and referencing relevant issue numbers.

---

## 🏁 Local Development Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v20 or newer)
- npm (v10 or newer)
- Either:
  - **VS Code v1.90+** with the official Antigravity extension, or
  - Standalone **Antigravity IDE**

### Getting Started

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/kalidahmdev/ZeroQuota.git
   cd ZeroQuota
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Build the Extension**:
   ```bash
   # Single build
   npm run compile

   # Continuous watch mode during active development
   npm run watch
   ```

4. **Launch & Debug**:
   - Open the project in VS Code or Antigravity IDE.
   - Press `F5` (or go to `Run and Debug` → select `Run Extension`).
   - A new **Extension Development Host** window will open with ZeroQuota activated.

---

## 🧪 Testing & Code Quality

ZeroQuota relies on an automated dual test suite powered by [Vitest](https://vitest.dev/) with comprehensive mocks for VS Code APIs, sidecar endpoints, and process discovery.

```bash
# Run tests with vitest
npm test

# Run full quality check (compile + lint + test)
npm run test:full

# Run ESLint check
npm run lint
```

All Pull Requests must pass `npm run test:full` without warnings or failures.

---

## 🎨 Code Style Guidelines

- **TypeScript**: Strict types enabled (`Node16` resolution, ES2022 target). Avoid `any` types where possible.
- **Linting**: Conforms to `.eslintrc.json`.
- **Architecture**: Keep sidecar communication, orchestrator logic, and webview dashboard state separated cleanly according to the project's folder layout in `src/`.

---

_ZeroQuota is an open-source project. By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE)._
