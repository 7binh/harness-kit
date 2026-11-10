---
name: handoff
description: Save the session's state into {{DIR}}/ so the next session, in any tool, can continue without this conversation. Use when the user says "handoff", "wrap up", "lưu ngữ cảnh", "chốt phiên", at the end of a phase, before ending a long session, and before the context is compacted.
---

# Handoff

Goal: a fresh agent that reads only the repository can pick up exactly where this session stops.

1. **Tasks**: in the active feature's `tasks.md` (folder name in `{{DIR}}/features/ACTIVE`), tick every task that is finished and whose check passed. Leave a task unticked when its check did not run or did not pass.
2. **Decisions**: for each choice made this session that the code does not explain (an alternative rejected, a document overruled, a ruling from the user), append an entry to `{{DIR}}/DECISIONS.md` in the format at the top of that file. When there were none, add nothing.
3. **State**: rewrite `{{DIR}}/STATE.md`, keeping its headings and staying under about 60 lines.
   - `Now`: branch, feature, stage, and the exact step in progress. If work stops mid-task, name the file and the next command to run.
   - `Done recently`: what landed this session, with commit hashes.
   - `Next`: up to three steps, most important first.
   - `Open questions`: what needs the user.
   - `Not verified`: checks that were skipped or failed, with the key line of the failing output.
   - Set `Last updated` to today's date.
4. **Check the claims**: every "passes" in `STATE.md` must come from a command run in this session. Otherwise move it under `Not verified`.
5. **Project knowledge**: if this session taught you something every later session needs (a command trap, an enforced rule, a missing context map row), add it to `{{DIR}}/PROJECT.md`. If the queue of work changed, update `{{DIR}}/ROADMAP.md`.
6. **Stray documents**: run `node {{DIR}}/.kit/kit.mjs doctor`. Move any working document it finds outside `{{DIR}}/` into the feature folder.
7. **Session log**: run `node {{DIR}}/.kit/kit.mjs log --agent "<your tool, e.g. claude-code, codex, cursor>" "<two or three sentences: what was done and what is left>"`. The script adds the time, branch, feature, stage, and the commits since the last entry. Do not edit files under `{{DIR}}/log/` by hand.
8. **Commit**: include `{{DIR}}/` in the commit of the work it describes. If the work is not ready to commit, leave the files modified and say so. Commit only when the user asks.
9. Tell the user what was saved, in three lines or fewer, and that `catchup` resumes it.
