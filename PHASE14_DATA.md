# StudyHub - Phase 14 data export, account control and gamification

This phase gives students control over their own data and tidies the rewards system.
No new tables, services, or environment variables.

## What changed

- Download my data: in Settings there is a new "Your data" section. A student can
  download a full JSON copy of their StudyHub data (profile, progress, flashcards,
  notes, planner, diagnostics, activity, chat) at any time. Good for trust and a sensible
  privacy practice for a UK product.
- Export flashcards (CSV): a one-click CSV of all flashcards (front, back, subject),
  ready to import into other tools like Anki or Quizlet. Commas and line breaks are
  escaped correctly.
- Reset progress: in the Danger zone, a student can reset their learning progress
  (XP, level, badges, streak, quiz history) while keeping their flashcards, notes and
  study plan. It asks for confirmation first.
- Gamification: reviewed and left as is. It already has the level and XP bar, daily
  challenges, achievements with progress towards locked badges, and a real-account
  leaderboard, so the polish was already in place.

## Manual setup

- None. This is front-end only and reads the data already stored for the student.

## What to test

- Open Settings, find Your data, and download the JSON. Open it and confirm it
  contains your flashcards, notes and progress.
- Export flashcards to CSV and open it in a spreadsheet; confirm the columns line up
  and any commas or quotes in a card are handled.
- Use Reset progress and confirm XP, badges and quiz history clear while your
  flashcards and notes remain.

## Honest notes

- The data export covers what is in the app for that student. When Supabase is
  configured, the same data also lives server-side; the export is a convenient local
  copy, not a separate server dump.
- After resetting progress, the always-on "First Steps" badge (which just means you
  have an account) is re-awarded immediately. That is expected.
- This is a self-service export and reset for the student. Deleting the whole account
  is still available in the Danger zone from Phase 2.
