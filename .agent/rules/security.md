---
trigger: always_on
---

# Antigravity Security Rules

> These rules are **automatically enforced** when Antigravity generates or modifies code in this project.

---

## Secrets Management

| Rule                      | Requirement                                                      |
| :------------------------ | :--------------------------------------------------------------- |
| **No Hardcoded Secrets**  | NEVER commit API keys, tokens, passwords, or connection strings. |
| **Environment Variables** | Use `process.env` or configuration objects to access secrets.    |
| **ConfigFile Safety**     | Do not output secrets to log files or console.                   |

```typescript
// ❌ Bad
const apiKey = "sk-1234567890";
const dbUrl = "postgres://user:pass@localhost:5432/db";

// ✅ Good
const apiKey = process.env.API_KEY;
const dbUrl = process.env.DATABASE_URL;
```

---

## Environment Configuration

| Rule                  | Requirement                                                            |
| :-------------------- | :--------------------------------------------------------------------- |
| **.gitignore**        | Ensure `.env` and `.env.*.local` are in `.gitignore`.                  |
| **Example File**      | Maintain `.env.example` with placeholder values for all required keys. |
| **Production Safety** | disable debug mode in production.                                      |

---

## Input Validation & Sanitization

| Rule                | Requirement                                                                                |
| :------------------ | :----------------------------------------------------------------------------------------- |
| **Sanitize Inputs** | Validate and sanitize all external inputs (API, user, URL params).                         |
| **SQL Injection**   | Use parameterized queries or ORM methods. NEVER concatenate strings for SQL.               |
| **XSS Prevention**  | Escape output when rendering user-generated content (e.g., utilize framework protections). |

```typescript
// ❌ Bad
const query = "SELECT * FROM users WHERE id = " + req.query.id;
dangerouslySetInnerHTML={{ __html: userContent }}

// ✅ Good
const query = "SELECT * FROM users WHERE id = $1"; // Parameterized
<div>{userContent}</div> // Framework escapes by default
```

---

## CORS & Network Security

| Rule                 | Requirement                                                                            |
| :------------------- | :------------------------------------------------------------------------------------- |
| **Explicit Origins** | Whitelist specific origins. Do NOT use `Access-Control-Allow-Origin: *` in production. |
| **Safe Methods**     | Restrict allowed HTTP methods (GET, POST, etc.) to what is necessary.                  |
| **HTTPS Only**       | Enforce HTTPS for all external communications.                                         |

---

## Authentication & Authorization

| Rule                | Requirement                                                             |
| :------------------ | :---------------------------------------------------------------------- |
| **Secure Storage**  | Store tokens in `httpOnly` cookies, not `localStorage` (XSS risk).      |
| **Token Expiry**    | Implement short-lived access tokens and refresh token rotation.         |
| **Least Privilege** | APIs should enforce role-based access control (RBAC) on every endpoint. |

---

## Error Handling

| Rule                 | Requirement                                                                               |
| :------------------- | :---------------------------------------------------------------------------------------- |
| **No Leaks**         | Do NOT expose stack traces or internal error details to the client in production.         |
| **Generic Messages** | Return generic error messages (e.g., "An error occurred") to users.                       |
| **Logging**          | Log detailed errors internally for debugging, but sanitize sensitive data before logging. |

```typescript
// ❌ Bad
res.status(500).send(error.stack);

// ✅ Good
console.error(error);
res.status(500).send({ message: "Internal Server Error" });
```

---

## Dependencies

| Rule                | Requirement                                                      |
| :------------------ | :--------------------------------------------------------------- |
| **Vetter Packages** | Prefer well-maintained, popular packages. Avoid abandonedware.   |
| **Audit**           | Run `npm audit` regularly and fix high-severity vulnerabilities. |
