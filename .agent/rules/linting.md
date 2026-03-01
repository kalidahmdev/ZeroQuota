# Antigravity Linting Rules

> These rules are **automatically enforced** when Antigravity generates or modifies code in this project.

---

## TypeScript/JavaScript

| Rule             | Requirement                                         |
| ---------------- | --------------------------------------------------- |
| Block statements | Always use `{}` — no inline `if (x) return y`       |
| Variables        | Use `const` by default, `let` only when reassigning |
| Unused code      | Remove all unused imports and variables             |
| Return types     | Explicit on exported functions                      |
| Exports          | Prefer named exports over default                   |
| Type imports     | Use `import type { X } from 'y'` for types          |

```typescript
// ❌ Bad
if (loading) return <Spinner />
let data = fetchData()
import { User } from './types'  // when only using type

// ✅ Good
if (loading) {
  return <Spinner />
}
const data = fetchData()
import type { User } from './types'
```

---

## Naming Conventions

| Element          | Convention                           | Example                               |
| ---------------- | ------------------------------------ | ------------------------------------- |
| Files            | `kebab-case.tsx` or `PascalCase.tsx` | `user-profile.tsx`, `UserProfile.tsx` |
| Components       | `PascalCase`                         | `UserProfile`                         |
| Functions/hooks  | `camelCase`                          | `getUserData`, `useAuth`              |
| Constants        | `SCREAMING_SNAKE_CASE`               | `MAX_RETRIES`                         |
| Types/Interfaces | `PascalCase`                         | `UserData`, `ApiResponse`             |

---

## React Patterns

```typescript
// ✅ Component structure
interface UserCardProps {
  user: User
  onSelect?: (id: string) => void
}

export const UserCard = ({ user, onSelect }: UserCardProps) => {
  // Early returns first
  if (!user) {
    return null
  }

  // Memoized callbacks (not inline in JSX)
  const handleClick = () => onSelect?.(user.id)

  return (
    <div onClick={handleClick}>
      {user.name}
    </div>
  )
}
```

**Rules:**

- Function components with arrow syntax
- Props interface: `{ComponentName}Props`
- Custom hooks start with `use`
- No inline functions/objects in JSX props
- Use `React.ReactNode` for children, not `React.FC`

---

## Import Organization

```typescript
// 1. External packages
import { useState } from "react";
import { motion } from "framer-motion";

// 2. Internal absolute imports
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

// 3. Relative imports
import { UserCard } from "./user-card";
import type { User } from "./types";
```

---

## Code Quality

| Guideline       | Target                    |
| --------------- | ------------------------- |
| Function length | ~50 lines max             |
| Nesting depth   | Prefer early returns      |
| Comments        | Explain "why", not "what" |
| Logic           | Extract to named helpers  |

---

## Project Exclusions

**Do NOT lint:**

- `**/components/ui/**` — shadcn/radix generated
- Files matching `.biomeignore` patterns

**Respect disabled rules in `biome.jsonc`:**

- a11y rules are disabled for flexibility
