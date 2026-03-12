# Contributing to ZeroQuota

Thank you for your interest in contributing to ZeroQuota! We welcome contributions from everyone.

## How to Contribute

### Reporting Bugs
- Use the **Bug Report** template when opening an issue.
- Provide a clear description of the problem and steps to reproduce.

### Suggesting Features
- Use the **Feature Request** template.
- Explain why the feature would be useful and how it should work.

### Pull Requests
1. Fork the repository.
2. Create a new branch for your changes.
3. Ensure your code follows the existing style (run `npm run lint`).
4. Submit a Pull Request with a clear description of your changes.

## 🏁 Local Development Setup

ZeroQuota is built as a native extension for **Antigravity IDE**. To set up your environment:

1. **Clone the Repo**:
   ```bash
   git clone https://github.com/kalidahmdev/ZeroQuota.git
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Compile**:
   ```bash
   npm run compile
   ```
4. **Launch**:
   - Open the project in the **Antigravity Extension Host** or similar environment using `F5` to start a new Extension Development Host instance with the extension loaded.

## Code Style
- We use ESLint for code linting.
- Follow the existing TypeScript patterns in the `src` directory.

---
_ZeroQuota is an open-source project. By contributing, you agree that your contributions will be licensed under the MIT License._
