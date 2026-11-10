---
name: catchup
description: Rebuild working context at the start of a session or after a gap, from the files in {{DIR}}/ and git rather than from memory. Use when the user says "catch up", "where were we", "tiếp tục", "đang làm tới đâu", or asks to continue earlier work without saying what it was.
---

# Catch up

Goal: know what is in flight and what to do next. Change nothing except the drift fixes in step 4.

1. Run `node {{DIR}}/.kit/kit.mjs status`. Read `{{DIR}}/STATE.md` and the last ten entries of `{{DIR}}/DECISIONS.md`.
2. Run `git status -sb` and `git log -10 --oneline`. Uncommitted files are unfinished work from the last session; `git diff --stat` shows what it was.
3. Open the active feature's `tasks.md` (folder name in `{{DIR}}/features/ACTIVE`). Find the first unticked task and its phase. Read `spec.md` or `plan.md` only for the part that task needs.
4. Compare the sources. Git history wins over `tasks.md`, and `tasks.md` wins over `STATE.md`. Correct `STATE.md` and `ACTIVE` to match, and tell the user what you corrected.
   - If `STATE.md` is still the install placeholder, fill it in now from what you found.
5. Report in the user's language, in this order:
   - Where things stand: branch, feature, stage, tasks done out of total.
   - Unfinished work: uncommitted changes and what they appear to be.
   - Next step: the single next task and the files it touches.
   - Decisions needed: open questions that block the next step.

Stop after the report. Start the next task only when the user confirms it.
