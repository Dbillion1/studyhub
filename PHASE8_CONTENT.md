# StudyHub - Phase 8 GCSE content structure

This phase organises the built-in revision content per subject and topic, labels
it honestly, and keeps it clearly separate from a student's own work.

## What changed

- Every subject now has a short "General GCSE revision" panel in the subject view:
  a focus summary, a few generic "how to revise this" tips, and a small set of
  sample flashcards.
- The Subjects tab shows a clear banner: this is general practice material, not
  aligned to a specific exam board, and students should check their own board
  (AQA, Edexcel, OCR, WJEC) for exact content.
- Sample flashcards are marked with a Sample badge. A student can press "Add to my
  cards" to copy a sample into their own deck, where it becomes a normal, editable
  card with spaced repetition. Until then, samples are not part of the student's
  data.
- The Quizzes tab is labelled "General practice".

## Why it is deliberately generic

GCSE content differs by exam board and changes over time. To avoid giving students
wrong or board-specific information, the built-in content is intentionally generic:
study guidance and widely-accepted facts only (for example, the quadratic formula,
the unit of force, what osmosis is). The app never claims to match a particular
specification, and the AI tutor and prompt library already ask students to name
their exam board when board-specific help is needed.

## How content is kept separate from a student's work

- Preset content lives in the app code (the `GCSE_CONTENT` structure) and is the
  same for everyone. It is read-only and clearly labelled.
- A student's own notes and flashcards live in their account (local storage and,
  when configured, the Supabase tables from Phase 3). Adding a sample card creates
  a brand-new card owned by the student; the original sample is untouched.

## Manual setup needed

- None. This phase is content and labelling only, with no new tables, environment
  variables, or services.

## What to test

- Open the Revision Hub, Subjects tab. You see the General GCSE revision banner.
- Open a subject. You see the focus summary, revision tips, and sample cards each
  with a Sample badge.
- Press "Add to my cards" on a sample. It appears in your Flashcards with no Sample
  badge and can be edited or reviewed like any card.
- Open the Quizzes tab and confirm the General practice label.

## Notes

- The sample sets are intentionally small and safe. They are a starting point, not
  a full course. The most powerful content route for students remains creating
  their own notes and flashcards and using the AI tutor with their exam board named.
