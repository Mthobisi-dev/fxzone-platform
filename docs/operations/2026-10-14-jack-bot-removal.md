# Jack Bot removal — 14 October 2026

Completed the user's requested one-time cleanup in the FxZone Supabase project
`cxmvfdnckedjvfcqsiiw`. This is an operational record, not a migration to replay.

The target was verified by both username `jackbot_analyst` and profile ID
`a0000000-0000-0000-0000-000000000002`, with display name `Jack Bot`.
It was a seeded public profile without an Auth identity or legacy profile row.

Before removal it had two posts, three followers, three conversation memberships,
no sent messages, and no hosted sessions. The posts had two comments and six
reactions. Existing foreign keys cascade the profile's dependent rows while
preserving conversations (`creator_id` uses `ON DELETE SET NULL`).

The cleanup locked and rechecked the exact target, aborted if an Auth identity
existed, deleted only that profile, and recalculated the affected users' follower
and following counts in one transaction. No schema or migration history changed.

The verification query returned:

| Check | Remaining rows |
| --- | ---: |
| Target profile / username | 0 |
| Bot-authored posts | 0 |
| Follow relationships involving the bot | 0 |

Application filters additionally exclude this username from public discovery,
profiles, connection lists and featured experts, and prevent new follows if
legacy seeding recreates it. Existing follow relationships may still be removed.
