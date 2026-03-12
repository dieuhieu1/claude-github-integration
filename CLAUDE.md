# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Development** (Windows - run directly in bash, not via `npm run dev` which fails on Windows):
```bash
NODE_OPTIONS='--require ./node-compat.cjs' npx next dev --turbopack
```

**Build:**
```bash
NODE_OPTIONS='--require ./node-compat.cjs' npx next build
```

**Lint:**
```bash
npm run lint
```

**Tests:**
```bash
npm run test               # Run all tests
npx vitest run <file>      # Run a single test file
```

**Database:**
```bash
npx prisma generate        # Regenerate Prisma client after schema changes
npx prisma migrate dev     # Apply new migrations
npm run db:reset           # Reset database (destructive)
```

**First-time setup:**
```bash
npm install && npx prisma generate && npx prisma migrate dev
```

## Architecture Overview

UIGen is an AI-powered React component generator. Users describe components in a chat interface; Claude generates them using a virtual file system with live in-browser preview.

### Key Concepts

**Virtual File System:** All generated code lives in-memory (`src/lib/file-system.ts` — `VirtualFileSystem` class). Nothing is written to disk. The file system is serialized as JSON into the database `Project.data` column.

**AI Tool Use:** The chat API (`src/app/api/chat/route.ts`) gives Claude two tools:
- `str_replace_editor` (`src/lib/tools/str-replace.ts`) — view/create/edit files via str_replace or insert
- `file_manager` (`src/lib/tools/file-manager.ts`) — rename/delete files

Tool calls are processed in `src/lib/contexts/file-system-context.tsx`, which applies them to the VirtualFileSystem and updates React state.

**Live Preview:** `src/components/preview/PreviewFrame.tsx` uses Babel standalone to transpile JSX in-browser. The entry point is always `/App.jsx`. Imports use the `@/` alias resolved against the virtual file system.

**LLM Provider:** `src/lib/provider.ts` returns the real `claude-haiku-4-5` model if `ANTHROPIC_API_KEY` is set, otherwise a `MockLanguageModel` that returns a static demo component.

### Route Structure

- `/` — Home page; authenticated users are redirected to their latest project
- `/[projectId]` — Project workspace (the main UI)
- `/api/chat` — Streaming POST endpoint; receives messages + current virtual files, streams back tool calls and text
- Middleware (`src/middleware.ts`) blocks `/api/projects` and `/api/filesystem` without a valid JWT session

### Authentication

JWT-based, stored in HTTP-only cookies (7-day expiry). Key files:
- `src/lib/auth.ts` — `createSession`, `getSession`, `verifySession`, `deleteSession`
- `src/actions/index.ts` — `signUp`, `signIn`, `signOut`, `getUser` server actions
- Anonymous usage is supported; `Project.userId` is nullable

### Database

SQLite via Prisma. Schema (`prisma/schema.prisma`):
- `User` — id, email, password (bcrypt), timestamps
- `Project` — id, name, userId (nullable), `messages` (JSON string), `data` (JSON string of virtual FS)

### UI Layout

Split panel (`src/app/main-content.tsx`):
- **Left (35%):** Chat interface — `src/components/chat/`
- **Right (65%):** Tabbed Preview/Code view
  - Preview: `src/components/preview/PreviewFrame.tsx`
  - Code: File tree (30%) + Monaco editor (70%) — `src/components/editor/`

### Path Aliases

`@/*` maps to `./src/*` (configured in `tsconfig.json`).

### Windows Note

The `node-compat.cjs` file removes non-functional `localStorage`/`sessionStorage` globals on the server to fix a Node.js 25+ compatibility issue. Always pass it via `NODE_OPTIONS='--require ./node-compat.cjs'` before running Next.js commands. On Windows, use bash (not cmd/PowerShell) or set the env var separately.
