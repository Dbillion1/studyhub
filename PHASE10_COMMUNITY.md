# StudyHub - Phase 10 community moderation and safeguarding

This phase makes the student community safer: posts and comments can sync to your
database, students can report posts, a basic word and personal-data filter blocks
obvious problems on the way in, and moderators or owners can review reports and
remove posts. Every moderator action is recorded.

## What changed

- The community is now backend-aware. When Supabase is configured, posts, likes and
  comments are written to the Phase 3 tables and the shared feed is loaded on login.
  Offline, it still works as a local feed on the device.
- A safeguarding filter runs when posting or commenting. It blocks email addresses
  and phone numbers (to stop students sharing personal contact details) and a short
  list of abusive words. The message never repeats the offending text. This is a
  first line of defence only, not a replacement for human moderation.
- Each post (that is not yours) has a Report button. Reports are private and stored
  for moderators.
- Moderators and owners see a "Moderator tools" bar with an open-reports count, can
  open a Reports panel, mark reports resolved, and delete any post. Deleting a post
  and resolving a report are written to a moderation log.
- The post composer now carries a clear safeguarding reminder, and the Discussion
  category is available everywhere.

## Manual setup

1. Run `SUPABASE_PHASE10.sql` in the Supabase SQL Editor. It is safe to run more than
   once. It creates `post_reports` and `moderation_log` with row-level security and
   adds staff-delete policies, reusing the Phase 3 helper functions.
2. Make someone a moderator (owners are set in Phase 3). In the SQL Editor:

```sql
update public.user_roles
set role = 'moderator'
where user_id = (select id from auth.users where email = 'moderator@example.com');
```

Roles live only in the database, so moderator powers never come from the browser
alone. The database policies are the real gate; the UI buttons just reflect them.

No new environment variables are needed.

## How safety is enforced (defence in depth)

- Client filter: blocks obvious abuse and personal contact details before sending.
  Easy to bypass on its own, which is why it is only the first layer.
- Row-level security: the Phase 3 and Phase 10 policies decide who can read, write,
  delete and moderate. A student cannot read others' reports or the moderation log,
  cannot delete other people's posts, and cannot give themselves a role. Only
  moderators and owners can. This was tested directly against Postgres.
- Human review: reports surface to moderators, who make the final call. The
  moderation log keeps an audit trail.

## What to test

- Try to post an email address or phone number, or an abusive word. It should be
  blocked with a friendly message.
- Report another student's post, then sign in as a moderator and confirm it appears
  in Reports, can be resolved, and the post can be deleted.
- As a normal student, confirm you cannot see the moderator tools or delete others'
  posts.

## Honest limitations

- The shared feed loads on login and when you open the Reports panel; it is not yet
  realtime (no live updates while two people are looking at once). A refresh or
  re-login pulls the latest.
- The word filter is deliberately short and basic. Determined misuse needs human
  moderators; the tools here are to support them, not replace them.
- If someone may be at risk, the app encourages telling a trusted adult. It is not a
  reporting service for emergencies.
