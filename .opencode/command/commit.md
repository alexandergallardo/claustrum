---
description: Create conventional commits from changes
agent: general
model: minimax/minimax-m2.1
---

Analyze the changes based on the following instructions: $ARGUMENTS

Read all relevant files in the project to understand what was modified. Group related changes together and create one or more conventional commits using the following format:

- Use conventional commits format: `<type>(<scope>): <description>`
- Types: feat, fix, refactor, docs, style, test, chore, perf, ci, build
- Keep each commit focused on a single concern
- Write clear, descriptive commit messages in English

For each commit:
1. List the files that should be included
2. Write the commit message following conventional commits
3. Execute the git commands to stage and commit the changes

If there are multiple unrelated changes, create separate commits for each.

After creating all commits, show a summary of the commits created with their messages and the files included in each.
