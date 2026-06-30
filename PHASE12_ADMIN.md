# StudyHub - Phase 12 owner admin and content management

This phase adds an owner-only admin console for running the site: an overview, user
and role management, content moderation, and the moderation log. It builds entirely
on the roles and policies from Phase 3 and the moderation tables from Phase 10, so
there is no new SQL.

## What changed

- Owners see an "Owner admin" section in Settings with a button to open the admin
  console. Non-owners never see it.
- The admin console has four parts:
  - Overview: total users, total posts, and open reports, plus a shortcut to the
    reports panel.
  - Users and roles: every user with their email and plan, and a dropdown to change
    their role (student, parent, moderator, developer, owner). Plans are read-only
    here because they are controlled by Stripe.
  - Recent posts: the latest posts with a delete button for content moderation.
  - Moderation log: a record of recent moderator and owner actions.

## How access is controlled

- The console only appears for an account whose role is `owner`, but that is just
  the UI. The real protection is the Phase 3 row-level security: only an owner can
  read all profiles and roles, change roles, and (with moderators) delete any post.
  A non-owner calling these directly is rejected by the database.
- Changing your own role away from owner asks for confirmation first, so you do not
  lock yourself out by accident.
- Role changes and admin deletions are written to the moderation log for an audit
  trail.

## Manual setup

- None new. This uses the Phase 3 `user_roles`, `profiles`, and `plans` policies and
  the Phase 10 `post_reports` and `moderation_log` tables. Make sure you have run
  `SUPABASE_PHASE3.sql` and `SUPABASE_PHASE10.sql`.
- You become the owner the same way as before (set once in the SQL editor):

```sql
update public.user_roles
set role = 'owner'
where user_id = (select id from auth.users where email = 'you@example.com');
```

No new environment variables.

## What to test

- As the owner, open Settings. You see Owner admin and can open the console.
- Confirm the overview counts load, change a test user's role and see it stick, and
  delete a test post and see it disappear from the feed.
- Sign in as a normal student and confirm the Owner admin section is not shown, and
  that the underlying actions are refused by the database if attempted.

## Honest limitations

- The console is a practical admin panel, not a full analytics suite. Stats are
  simple counts and the lists are capped (users to 500, posts to the latest 20, log
  to the latest 30). Fine for a growing app; pagination can be added later.
- It needs the online backend; there is no offline admin.
- Deleting a post here removes it for everyone. There is no undo, which is why it
  asks for confirmation and records the action in the log.
