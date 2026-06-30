# StudyHub - Phase 7 revision hub: notes, flashcards, spaced repetition, uploads

This phase upgrades the Revision Hub. Notes, flashcards and quiz results now save
to your account when Supabase is configured, flashcards use spaced repetition so
students review at the right time, and Pro users can upload note files.

## What changed

- The "My Notes" tab is now called "Notes".
- Flashcards now use spaced repetition. Each card has a review schedule, and the
  Flashcards tab shows a "Review N due cards" button when cards are due. In a
  review you flip the card, then choose Got it or Missed:
  - Got it moves the card to a longer interval: same day, then 1 day, then 3 days,
    then 7 days.
  - Missed resets the card so it comes back the same day.
- Notes, flashcards and quiz results save to Supabase (the `notes`, `flashcards`
  and `quiz_attempts` tables from Phase 3) when it is configured, and load on
  login so they follow the student across devices. Everything still works offline
  using local storage if Supabase is not set up.
- Pro and Ultimate users get an Upload (Pro) button in Notes to upload a file
  (image, PDF or document). Free users are prompted to upgrade.

## Manual setup: the file-upload storage bucket

Uploads need a Supabase Storage bucket called `notes`. Do this once.

1. In the Supabase Dashboard, open Storage and create a new bucket named exactly
   `notes`. Keep it private (do not make it public).
2. In the SQL Editor, run the policies below so each user can only see and manage
   their own files. Files are stored under a folder named after the user's id.

```sql
-- Create the bucket if you prefer SQL over the dashboard:
insert into storage.buckets (id, name, public)
values ('notes', 'notes', false)
on conflict (id) do nothing;

-- Each user can only work with files inside their own folder in the notes bucket.
create policy "notes_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'notes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "notes_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'notes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "notes_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'notes' and (storage.foldername(name))[1] = auth.uid()::text);
```

If the bucket or policies are missing, the rest of the app still works; only the
upload button will show a friendly error.

No new environment variables are needed.

## What to test

- Open the Revision Hub. The fourth tab reads Notes.
- Create a few flashcards. In the Flashcards tab you see a Review button. Run a
  review, choose Got it and Missed on different cards, and confirm the due count
  goes down and cards come back on schedule.
- Create a note and a quiz result. If Supabase is configured, log in on another
  browser and confirm your notes and flashcards are there.
- As a Pro or Ultimate user, upload a file in Notes, open it with the link, then
  delete it. As a free user, confirm the upload button prompts an upgrade.

## Notes

- Older flashcards and notes created before this phase are automatically given the
  right ids and review fields the first time the Revision Hub loads, so they sync
  cleanly.
- Spaced repetition uses a simple, well understood box system (same day, 1, 3 and
  7 days). It is deliberately gentle rather than a heavy algorithm.
- Uploaded files are private to each student through the storage policies above.
  The app opens them using short-lived signed links.
