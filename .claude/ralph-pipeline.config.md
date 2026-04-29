# Ralph Pipeline Configuration — Phase 6 Domain-Suite Port

task_file: docs/phase-6-tasks.md
base_branch: main
on_stuck: skip
max_parallel: 1
work_max_iterations: 20

verify:

- bun run --filter=cinder lint
- bun run --filter=cinder typecheck
- bun run --filter=cinder test

reviewers:

- copilot

review_bot_patterns:

- copilot
- bugbot
- coderabbit

worktree_dir: ../cinder-worktrees
branch_prefix: phase-6/
