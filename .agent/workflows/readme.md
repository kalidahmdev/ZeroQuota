---
description: Generates a GOD-TIER, Exhaustive README with HTML Headers, Emojis, and Tables.
---

# Hyper-Detailed README Generator

Use this workflow to generate a `README.md` that covers **100%** of the codebase details. No feature, file, or deeply nested component should be missed.

## Phase 1: Deep Codebase Extraction (The Audit)

1. **Asset & Design Scan**:
   - Check standard asset folders: `assets/`, `public/`, `static/`.
   - Identify Design Tokens if present: `constants/Colors`, `tailwind.config.js`, `theme.ts`, or CSS/SASS variables.

2. **Feature Inventory (Iterative Scan)**:
   - **Modular Scan**: Iterate through the source folder (`src/`, `app/`, `lib/`, `pkg/`, or root for smaller projects).
   - **Components/Classes**: Look for reusable units in `components/`, `widgets/`, `classes/`.
   - **Logic layer**: Check `services/`, `utils/`, `controllers/`, `middleware/`.
   - **Entry Points**: Identify `index.js`, `main.go`, `App.tsx`, or `manage.py`.

3. **Tech Stack Forensics**:
   - **Manifest Detection**: Analyze `package.json` (JS/TS), `requirements.txt` (Python), `go.mod` (Go), `Cargo.toml` (Rust), or `pom.xml` (Java).
   - **Framework ID**: Is it Next.js? Django? Gin? Flutter? Spring Boot?
   - **Database**: Look for ORMs (Prisma, TypeORM, Gorm, SQLAlchemy).

4. **Environment Forensics**:
   - Extract `process.env`, `Config.get`, or `os.getenv` usage.
   - Cross-reference with `.env.example`.

5. **Interface & Infra Audit**:
   - **API**: Identify Public APIs, Webhooks, or exported Service methods.
   - **Ops**: Check `Dockerfile`, `docker-compose.yml`, `.github/workflows`, `vercel.json`.
   - **Telemetry**: Scan for Sentry, PostHog, Datadog imports.

6. **Architecture Extraction**:
   - Identify State Management (Redux, Context, Zustand).
   - Infer the "Philosophy" (e.g., Feature-Sliced, Monorepo, Microservices).

7. **Quality & Data Forensics**:
   - **Testing**: Scan for `__tests__`, `.spec.ts`, `.test.js`, and config files (`jest.config.js`, `playwright.config.ts`).
   - **i18n**: Check for `locales/`, `lang/`, or `messages/` folders.
   - **Data**: Search for `schema.prisma`, `models/`, or key Entity definitions.

8. **Operational Forensics**:
   - **Status**: Look for `ROADMAP.md`, `TODO.md`, or `// FUTURE:` comments. Check `package.json` version for maturity (v0 vs v1).
   - **Performance**: Search for caching (`Redis`, `useMemo`), compression, or lazy-loading strategies.
   - **Troubleshooting**: Scan for common error logs or `docs/troubleshooting.md`.

## Phase 2: Content Generation (The Template)

**CRITICAL INSTRUCTION**: You MUST follow this exact HTML/Markdown structure. Do NOT summarize. Be Verbose. NEVER mention "Made with Antigravity" or similar AI branding.

### 1. The Header (HTML)

- Use `<p align="center">` for Logo (`assets/images/Logo.png`).
- Use `<h1 align="center">` for Project Name.
- Use `<p align="center">` for the Slogan.
- Use `<p align="center">` for the "Features • Tech Stack" links.
- **Badges**: Generate `img.shields.io` badges for the **Detected** Language/Frameworks. (Style: `flat-square`).
  - Example: `[React]`, `[Python]`, `[Go]`, `[Docker]`.

### 2. The Features (The "Meat")

- **Rule**: Every Major Module gets a `### Header` with a **Context-Relevant Emoji**.
  - Example: `💳` for Payments, `👤` for Profile, `🎮` for Game Logic.
- **Rule**: Every Function/Component gets a Row in a Table.
- **Format**:

  ```markdown
  ### [Emoji] Major Feature Name

  | Feature              | Description                                     |
  | :------------------- | :---------------------------------------------- |
  | **Sub-Feature Name** | Detailed technical description of what it does. |
  ```

- **Example**: If scanning `components/auth`, list "Login", "Signup", "Reset Password".

### 3. Tech Stack & Architecture

- **Core Philosophy**: Explain _why_ this stack was chosen (e.g., "Feature-Sliced for scalability").
- **State Management**: Explain the "Brain" of the app (e.g., "Zustand for global, React Query for server").
- Create a Table for "Core Framework", "Language", "Database", and "Key Libraries".

### 3.5 Configuration & Environment 🔑

- **Rule**: Generate a table of all `.env` variables found.
- **Format**: `| Variable | Description | Default | Required |`

### 4. Project Structure

- Run `tree` (exclude `node_modules`, `venv`, `target`, `vendor`).
- Comment on key folders found in Phase 1.

### 4.5 API & Interaction 🚀

- **Rule**: If a backend/service layer exists, list the core "Public Surface Area."
- **Format**: `| Endpoint/Method | Description | Parameters |`

### 5. Getting Started

- Prerequisites (Node version, Xcode/Android Studio).
- Installation Steps (Git clone, npm install, .env setup).

### 6. Design System

- Describe the "Visual Language" found in Phase 1 (e.g., "Liquid Glass", "Neomorphism").
- List the Typography and Color System found in `constants/`.

- **Requirement**: List the deployment targets (e.g., Vercel, AWS, Heroku) and Telemetry (Sentry).

### 8. Testing & Quality Assurance 🧪

- **Rule**: List the testing frameworks and the "Coverage Goals."
- **Format**: `| Test Type | Tool | Purpose |` (e.g., Unit/Vitest, E2E/Playwright).

### 9. Data Architecture 🗄️

- **Rule**: If a Database/ORM exists, briefly explain the core entities and their relationships.
- **Format**: `| Entity | Description | Relationships |`

### 10. Localization & Compliance 🌍

- **Rule**: List all supported languages found in Phase 1 (i18n).
- **Format**: `| Language | Status | Completion % |`

### 11. Glossary 📖

- **Glossary**: Define project-specific jargon found in code comments (e.g., "The Sanitizer", "Hydrator").

### 12. Troubleshooting & FAQ 🆘

- **Rule**: Create a table for common pitfalls found during the scan.
- **Format**: `| Issue | Symptom | Solution |`

### 13. Performance & Optimization ⚡

- **Rule**: Highlight how the project handles scale (e.g., "Image optimization", "DB Indexing").

### 14. Visual Gallery (UI Projects Only) 📸

- **Rule**: Use an HTML table to create a 2x2 or 3x3 grid for screenshots found in `assets/screenshots/`.

### 15. Roadmap & Maturity 🗺️

- **Rule**: List future plans and current status (Alpha/Beta/Stable).
- **Format**: Markdown checkboxes `[x]`.

## Phase 3: Writing the Manual

**ACTION**: Write the content to `README.md`.

- Ensure NO "placeholder" text. Use actual finding from Phase 1.
- Ensure Emojis are used for every section header (e.g., 🎨, 🛠️, 🚀).
