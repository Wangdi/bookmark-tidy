# Parallel Execution Plan - Git Worktrees

Date: 2026-05-14

## Overview

Implement 4 features in parallel using Git worktrees for isolated development.

**Features:**
- Feature 2: Category Editor (3-4 days)
- Feature 3: Detailed Progress (2-3 days)
- Feature 4: Background Notification (1-2 days)
- Feature 5: Auto-navigate (1 day)

**Timeline:** 3-4 days (vs 7-10 days sequential)

---

## Phase 1: Setup Git Worktrees

```bash
# 1. Create worktrees directory
mkdir -p .worktrees

# 2. Add to .gitignore
echo ".worktrees/" >> .gitignore
git add .gitignore
git commit -m "chore: ignore worktrees directory"

# 3. Create worktrees
git worktree add .worktrees/background-notification -b feature/background-notification
git worktree add .worktrees/auto-navigate -b feature/auto-navigate
git worktree add .worktrees/detailed-progress -b feature/detailed-progress
git worktree add .worktrees/category-editor -b feature/category-editor

# 4. Install dependencies in each worktree
for dir in .worktrees/*/; do
  (cd "$dir" && pnpm install)
done
```

---

## Phase 2: Dispatch Parallel Agents

Each agent works in its own worktree:

| Agent | Worktree | Branch | Plan |
|-------|----------|--------|------|
| 1 | `.worktrees/background-notification/` | `feature/background-notification` | `docs/superpowers/plans/2026-05-14-background-notification.md` |
| 2 | `.worktrees/auto-navigate/` | `feature/auto-navigate` | `docs/superpowers/plans/2026-05-14-auto-navigate.md` |
| 3 | `.worktrees/detailed-progress/` | `feature/detailed-progress` | `docs/superpowers/plans/2026-05-14-detailed-progress.md` |
| 4 | `.worktrees/category-editor/` | `feature/category-editor` | `docs/superpowers/plans/2026-05-14-category-editor.md` |

### Agent Configuration

```markdown
# Task: Implement [Feature Name]

**Working Directory:** `.worktrees/[feature-name]/`
**Plan File:** `docs/superpowers/plans/2026-05-14-[feature-name].md`
**Branch:** `feature/[feature-name]`

**Instructions:**
- Work ONLY in your assigned worktree
- Follow the plan step-by-step (TDD)
- Commit after each task
- Run tests to verify

**Constraints:**
- Do NOT switch branches
- Do NOT modify files outside feature scope
- Do NOT work in other worktrees
```

### Dispatch Command

```
"I'm using the dispatching-parallel-agents skill to implement 
all 4 features in parallel, each agent in its own worktree"
```

---

## Phase 3: Verify and Merge

### Verify Tests

```bash
# Check each worktree
cd .worktrees/background-notification && pnpm test && cd ../..
cd .worktrees/auto-navigate && pnpm test && cd ../..
cd .worktrees/detailed-progress && pnpm test && cd ../..
cd .worktrees/category-editor && pnpm test && cd ../..
```

### Merge Branches

```bash
# Return to main repo
cd /path/to/bookmark-tidy

# Merge each feature
git checkout main
git merge feature/background-notification
git merge feature/auto-navigate
git merge feature/detailed-progress
git merge feature/category-editor
```

### Cleanup

```bash
# Remove worktrees
git worktree remove .worktrees/background-notification
git worktree remove .worktrees/auto-navigate
git worktree remove .worktrees/detailed-progress
git worktree remove .worktrees/category-editor

# Delete branches (optional)
git branch -d feature/background-notification
git branch -d feature/auto-navigate
git branch -d feature/detailed-progress
git branch -d feature/category-editor
```

---

## Troubleshooting

### Worktree Already Exists

```bash
git worktree remove .worktrees/[feature-name]
git worktree add .worktrees/[feature-name] feature/[feature-name]
```

### Branch Already Exists

```bash
git worktree add .worktrees/[feature-name] feature/[feature-name]
```

### Tests Fail in Worktree

```bash
cd .worktrees/[feature-name]
pnpm install
pnpm test
```

---

## File Structure

```
bookmark-tidy/
├── .git/
├── .worktrees/
│   ├── background-notification/
│   ├── auto-navigate/
│   ├── detailed-progress/
│   └── category-editor/
└── docs/superpowers/plans/
    ├── 2026-05-14-background-notification.md
    ├── 2026-05-14-auto-navigate.md
    ├── 2026-05-14-detailed-progress.md
    └── 2026-05-14-category-editor.md
```
