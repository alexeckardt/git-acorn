# 🌰 git-acorn

A small, streamlined git client for solo developers — a lighter alternative to
GitHub Desktop with the quality-of-life of VSCode's source control, and a
**commit graph that's always visible**.

## Features (v0.1)

- **Changes view** like VSCode / GitHub Desktop — staged and unstaged files,
  stage/unstage/discard per-file or all at once.
- **Commit box** with a separate summary and description (⌘/Ctrl+Enter to commit).
- **Diff viewer** with **inline** and **side-by-side** modes.
- **Always-on commit graph** (Git Graph–style lanes), with branch/tag/HEAD chips.
  Click any commit to see its author, message, and changed files.
- **Per-file history** — click the 🕘 on any file to filter the graph to just the
  commits that touched it, so you can see exactly when a change landed.
- Fully **offline**; it just shells out to your local `git` CLI.

## Architecture

| Layer | Location | Role |
|-------|----------|------|
| Main | `src/main/git.ts` | Runs `git` via `child_process` and parses its output (`status --porcelain=v2 -z`, `log --topo-order`, `show --numstat`, etc.) |
| Main | `src/main/index.ts` | Window lifecycle + IPC handlers |
| Preload | `src/preload/index.ts` | `contextBridge` exposing a typed `window.gitApi` |
| Renderer | `src/renderer/src/` | React UI (graph layout in `lib/graph.ts`) |
| Shared | `src/shared/types.ts` | Types used across all three processes |

## Develop

```bash
npm install
npm run dev        # launch the app with hot reload
npm run typecheck  # tsc across main + renderer
npm run build      # production bundle into out/
```

## Ideas for next iterations

- Push / pull / fetch and branch switching
- Stage individual hunks / lines
- Amend last commit, discard-all, and undo
- Diff search and word-level highlighting
