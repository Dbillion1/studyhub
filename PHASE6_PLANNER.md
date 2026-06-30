# StudyHub - Phase 6 smart study planner and evidence-based progress

This phase adds a guided study plan on top of the existing calendar. Students
answer a few questions, StudyHub builds a weekly set of revision tasks, and
progress only moves when the student logs evidence of doing the work, not just by
ticking a box. The original calendar, sessions and goals are unchanged.

## What was added

- A Smart study plan card at the top of the Study planner page.
- A short setup questionnaire: subjects, target grade, optional exam date, which
  days you can study, minutes per day, preferred study style, and whether to spend
  extra time on weak subjects.
- Automatic generation of a weekly task list from those answers. Weak subjects get
  more time when that option is on.
- Evidence-based completion: to mark a task done, the student picks how they did it
  (self-confirm, reviewed flashcards, took a quiz, made notes, wrote answers, or
  checked with the AI tutor) and can add a short note. Completing a task awards XP.
- A weekly progress bar based on completed tasks, plus Regenerate week and Edit
  settings actions.

## Where the data lives

Everything works offline in the browser first, then mirrors to Supabase when it is
configured, using the tables created in Phase 3:

- `planner_onboarding`: the student's plan settings (one row per user).
- `planner_tasks`: the generated weekly tasks.
- `task_evidence`: the evidence logged against each task.

These writes go through the normal signed-in connection and are protected by the
row level security from Phase 3, so a student can only read and change their own
planner rows. When the student logs in on another device, their plan and progress
load from Supabase. If Supabase is not configured, the planner still works fully on
that device using local storage.

## Manual setup needed

- None beyond the earlier phases. Make sure `SUPABASE_PHASE3.sql` has been run so
  the planner tables exist. No new environment variables.

## What to test

- Open the Study planner. Before setup you see a Set up my plan button.
- Complete the setup. A weekly task list appears with a progress bar.
- Click Complete on a task, choose an evidence type, and log it. The task shows as
  done with the evidence type, the progress bar moves, and you earn XP.
- Use the undo arrow to mark a task not done again.
- Use Regenerate week to get a fresh set of tasks for the current week.
- If Supabase is configured, log in on another browser and confirm the plan and
  progress are there.

## Notes

- Tasks are generated for the current week (Monday to Sunday). Regenerating
  replaces this week's tasks and clears this week's evidence.
- The plan is a helpful starting structure, not a rigid timetable. Students can
  still use the calendar, sessions and goals exactly as before.
