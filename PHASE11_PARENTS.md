# StudyHub - Phase 11 parent accounts and weekly reports

This phase adds weekly progress reports and lets a parent or guardian follow a
student's progress, with the student's approval. Following a child is an Ultimate
feature. Everything lives in Settings under a new Family section.

## What changed

- Weekly report: a summary of the student's week (quizzes, flashcards made, planner
  tasks done, posts, current streak, total XP, focus areas). The student sees it in
  Settings, and it is saved to the database so an approved parent can read it.
- Family linking with the student in control:
  - Each student has a family code (their account id) shown in Settings.
  - A parent enters that code to send a follow request.
  - The student approves or declines. Only after approval can the parent read the
    student's profile name and weekly reports. The student can revoke at any time.
- Following a child is gated to Ultimate. A student on any plan can still share their
  code and approve a request, so a parent who has Ultimate can follow a child who does
  not.

## Why this design is safe

- Nothing is shared until the student approves. Knowing a family code only lets
  someone create a pending request; it grants no access on its own.
- The database row-level security from Phase 3 is the real gate. A parent can only
  read a child's profile and weekly reports when an approved link exists
  (`is_approved_parent_of`). The browser UI just reflects those rules.
- The student can revoke access at any time, which immediately cuts off reading.

## Manual setup

- None new. This uses the `parent_child_links` and `weekly_reports` tables and the
  approved-parent policies created by `SUPABASE_PHASE3.sql`. If you have already run
  the Phase 3 SQL, there is nothing to add. No new environment variables.
- Optional: if you want linked parents to show up with the role "parent" for your own
  reporting, you can set it in the SQL editor, but it is not required for the feature
  to work (linking is governed by the links table, not the role).

## What to test

- As a student, open Settings and find the Family section. You see your week summary
  and your family code.
- On a second account with Ultimate, enter the first account's family code and send a
  request. On the first account, approve it. The parent account should then see the
  child listed with their latest weekly report.
- Revoke the link and confirm the parent can no longer see the report.
- As a non-Ultimate account, confirm you can still share your code and approve, but
  the "follow a child" box invites you to upgrade.

## Honest limitations

- Weekly reports refresh when Settings is opened and are saved then; they are not a
  live dashboard. The activity counts come from the recent activity log, so a very
  busy week could under-count older actions. Totals like streak and XP are current,
  not week-only.
- Linking uses the account id as the family code. It is long, but it is safe to share
  because approval is always required. A friendlier short code would need extra
  server-side lookup, which can be added later.
- Family features need the Supabase backend and a signed-in account; they do not work
  in offline local mode.
