# StudyHub - Phase 3 database and security

This explains the schema in `SUPABASE_PHASE3.sql`, what every table is for, how
row level security (RLS) protects it, and the manual steps to finish setup.

## Where and how to run it

1. Open Supabase Dashboard, choose your project, open the SQL Editor.
2. Paste the entire contents of `SUPABASE_PHASE3.sql` and run it.
3. It is additive and idempotent. It is safe whether or not you already ran the
   original `SUPABASE_SCHEMA.sql`, and safe to run again later. It is now the full
   schema, so going forward run this file rather than the original.

You do not need new environment variables for Phase 3. Your existing Stripe and
auth Netlify Functions keep working unchanged.

## Security model in plain terms

- The **service-role key** is used only by your Netlify Functions on the server.
  It bypasses RLS, so functions can do privileged work (for example the Stripe
  webhook setting a user's plan).
- The **browser** uses the public anon key and acts as the `authenticated` role.
  Everything it can do is limited by the RLS policies in this file. The frontend
  is not trusted to enforce anything on its own.

Two specific protections worth calling out:

1. **No plan tampering.** The existing policy lets a user update their own profile
   row. On its own that would also let them set their own `plan` to `ultimate`
   from the browser. A trigger (`protect_profile_columns`) now freezes the
   payment and identity columns for browser requests, so a user can only change
   their name and learning profile. Only the service role (your webhook) can
   change `plan`, `subscription_status` and the Stripe fields.
2. **No role escalation.** The privileged role does not live in `profiles`. It
   lives in `user_roles`, which normal users cannot write to at all. They can
   read their own role, nothing more. Only the owner (or a function using the
   service-role key) can change roles.

## Roles

Stored in `user_roles.role`, one of: `student`, `parent`, `owner`, `developer`,
`moderator`. New accounts are auto-created as `student` by a signup trigger.

- `student`: normal user. Sees and edits only their own content.
- `parent`: a normal user who can be linked to a child (parent features are gated
  to the Ultimate plan in a later phase). A parent can only see a child's data
  after the child approves the link.
- `moderator`: can delete any community post or comment. No access to other
  users' private study data.
- `owner`: full administration. Can manage roles, read all profiles, and manage
  all content.
- `developer`: reserved for future use. Currently treated like a normal user by
  the policies (no elevated access granted yet).

### Make yourself the owner (one-time manual step)

After your account exists, run this once in the SQL Editor, using your email:

```sql
update public.user_roles
set role = 'owner'
where user_id = (select id from auth.users where email = 'you@example.com');
```

There is deliberately no way to become an owner or moderator from the website.

## Tables

- **profiles**: one row per user. Account basics (`email`, `full_name`), the
  active plan and Stripe fields, and a `profile` jsonb holding learning details
  (year, subjects, target grade, strong and weak subjects, onboarded flag, and
  the profile picture). Compatible with your existing functions.
- **user_roles**: the user's role and optional `tags`. The security backbone.
- **parent_child_links**: links a parent to a child with a `status` of `pending`,
  `approved` or `revoked`. A parent creates a pending request; the child approves.
  Only the two people involved (or the owner) can see or change a link.
- **plans**: a small read-only catalogue of plan definitions (free, pro,
  ultimate). The user's actual active plan stays in `profiles`, driven by Stripe.
- **posts**, **post_comments**, **post_likes**: the community. Any signed-in user
  can read. Authors manage their own; moderators and the owner can delete any.
- **notes**: user-written revision notes (subject, title, body).
- **uploaded_notes**: Pro/Ultimate note uploads. Stores a `storage_path` (the file
  itself goes in a Supabase Storage bucket, set up in Phase 7), any extracted text,
  and an `analysis` jsonb.
- **flashcards**: user flashcards with spaced-repetition fields (`confidence`,
  `last_reviewed`, `next_review`, `correct_count`, `incorrect_count`) used in Phase 7.
- **quiz_attempts**: a record of each quiz a user completes (subject, score, total,
  percent, details).
- **planner_onboarding**: one row per user holding the planner questionnaire answers.
- **planner_tasks**: weekly revision tasks (title, subject, due date, status).
- **task_evidence**: proof a task was completed (quiz score, flashcards reviewed,
  note, written answer, AI-marked, self-confirmed, or parent/moderator confirmed).
- **weekly_reports**: a weekly summary per student. Readable by the student, the
  owner, and an approved parent only.
- **ai_usage**: one row per user per day tracking AI tutor usage (GPT and Gemini
  counts, estimated tokens, blocked flag). Written by the AI function in Phase 5.

## RLS summary

- **Private study content** (`notes`, `uploaded_notes`, `flashcards`,
  `quiz_attempts`, `planner_onboarding`, `planner_tasks`, `task_evidence`,
  `weekly_reports`, `ai_usage`): a user can only see and change their own rows.
  The owner can administer all of them. Moderators are deliberately not given
  access to private study data, to protect student privacy. Weekly reports are
  additionally readable by an approved parent.
- **Community** (`posts`, `post_comments`, `post_likes`): readable by any
  signed-in user. Insert only as yourself. You can edit and delete your own;
  moderators and the owner can delete any post or comment.
- **profiles**: a user reads and updates only their own row (with payment and role
  columns frozen). The owner can read all profiles; an approved parent can read
  their linked child's profile.
- **user_roles**: read your own (owner reads all). Only the owner can write.
- **parent_child_links**: only the parent or child in the link (or owner) can see
  or change it.
- **plans**: readable by everyone, writable only by the owner.

## How the app reads a user's role

From the browser you can read your own role (RLS allows it):

```js
const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId).single();
```

Wiring roles into the UI (admin pages, moderator buttons) happens in later phases
(Phase 10 and Phase 12). Phase 3 only lays the secure foundation.

## Manual setup checklist

- Run `SUPABASE_PHASE3.sql` in the SQL Editor.
- Set your owner account with the SQL snippet above.
- No new environment variables. No change to existing functions.
- A Supabase Storage bucket for `uploaded_notes` files is set up later (Phase 7);
  the table is ready for it now.

## Manual tests

- The SQL runs with no errors (and can be run twice with no errors).
- You can still sign up and log in normally (login is not blocked by RLS).
- A new signup automatically gets a `profiles` row and a `student` role.
- Community posts can be read once posts exist.
- A normal user cannot read or edit another user's notes, flashcards or profile.
- A normal user cannot change their own plan or role from the browser.
- After setting yourself as owner, you can read all profiles and delete any post.
