# StudyHub - Phase 9 diagnostic assessment and AI marking

This phase adds two things to the Revision Hub Quizzes tab: a quick diagnostic that
gauges where a student is, and AI marking of written answers. Both are clearly
framed as GCSE-style practice, not an official examiner or exam board mark scheme.

## Diagnostic assessment

- A short multiple-choice check across the student's subjects (or a single chosen
  subject). It uses the built-in practice questions, so it costs nothing and does
  not use any AI messages.
- At the end it shows a percentage per subject, an overall result, a plain-language
  level (Building foundations, Developing, Secure, Strong, Excellent), and the
  weakest one or two subjects.
- The student can press "Set as my focus" to mark those subjects as weak areas,
  which updates their profile and, if they have a study plan, regenerates this
  week's tasks to prioritise them.
- It is labelled as general practice, not an official assessment or grade.

## AI marking

- A "Mark my answer" tool: the student picks a subject, enters a question (and an
  optional marks total), pastes their written answer, and gets GCSE-style feedback:
  an estimated mark or band, what they did well, how to improve, and the key points
  a top answer would include.
- This uses the same secure, login-only AI endpoint as the tutor, so it is covered
  by the daily usage limits from Phase 5. A free student who runs out sees a friendly
  message that suggests turning the topic into flashcards to keep revising for free,
  or upgrading for more marking.
- It is clearly labelled as practice guidance, not an official mark, with a reminder
  to check the exam board mark scheme.

## Why this is safe

The marking quality comes from the model's strong understanding of the subjects.
The app never claims to be an official examiner or to match a specific exam board.
It gives honest, useful feedback at GCSE standard and points the student to their
own board for exact wording and marks.

## Manual setup needed

- None beyond the earlier phases. AI marking needs the AI backend configured
  (the same `OPENAI_API_KEY` and Supabase login you already set up); the diagnostic
  needs nothing.

## What to test

- Open the Revision Hub, Quizzes tab. You see a Diagnostic card.
- Run a diagnostic across your subjects, answer the questions, and check the results
  and the "Set as my focus" button (then confirm your planner updates if you have one).
- Press "Mark a written answer", enter a question and answer, and confirm you get
  structured feedback. As a free user who has hit the daily limit, confirm the
  message suggests flashcards and offers an upgrade.

## Notes

- The diagnostic deliberately reuses the general practice question bank, so it is
  exam-board-neutral like the rest of the built-in content.
- AI marking is the one part here that uses AI messages, by design, so its cost is
  controlled by the Phase 5 limits.
