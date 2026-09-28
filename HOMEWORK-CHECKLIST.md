# Homework completion checklist

## Before Test 1

- Run the Supabase migration.
- Create `Sales` and `Expenses` tabs and share the sheet with the service account.
- Deploy to Vercel and configure all environment variables.
- Set the Telegram webhook.
- Start the bot in a private chat.
- Link your Telegram user ID to Richard and submit S01 through the bot.
- Relink the same Telegram user ID to Kevin and submit E01 through the bot.
- Remove any earlier practice records before beginning the official test.

## Test 1 entries

Enter S02 through the website as Anastasia. Enter E02 and E03 as Kevin.

| Ref | Type | Amount | Project or proposal | Proposed split |
| --- | --- | ---: | --- | --- |
| S01 | Sale by Richard | €1,000 | A | 50 / 30 / 20 |
| S02 | Sale by Anastasia | €2,000 | B | 0 / 50 / 50 |
| E01 | Materials | €120 | A | — |
| E02 | Travel | €80 | B | — |
| E03 | Other | €100 | Company overhead | — |

As Svetlana, approve S01 unchanged, change S02 to 20 / 40 / 40, allocate E01 to A, and move E02 from B to A.

Expected results: Project A €700; Project B €1,800; Company €2,400. Commission earned: Richard €90; Anastasia €110; Jean-Claude €100.

## Test 2 entries

Keep Test 1 data. Enter all items through the website under the correct roles.

| Ref | Type | Amount | Project or proposal | Proposed split |
| --- | --- | ---: | --- | --- |
| S03 | Sale by Jean-Claude | €1,500 | A | 40 / 40 / 20 |
| S04 | Sale by Richard | €800 | B | 25 / 25 / 50 |
| S05 | Sale by Richard | €600 | B | 100 / 0 / 0 |
| E04 | Materials | €250 | B | — |
| E05 | Travel | €90 | A | — |
| E06 | Other | €60 | Company overhead | — |
| E07 | Materials | €140 | A | — |

As Svetlana, change S03 to 20 / 30 / 50, approve S04 unchanged, leave S05 pending, allocate E04 to B, move E05 from A to B, and leave E07 awaiting allocation.

Expected cumulative results: Project A €2,050; Project B €2,180; Company €3,930. Commission earned: Richard €140; Anastasia €175; Jean-Claude €215. Pending sales €600; expenses awaiting allocation €140.

## Permission and failure checks

- Reject 60 / 30 / 20 because the shares exceed 100%.
- Deny sale approval while acting as Richard.
- Deny sale submission while acting as Kevin.
- Reject missing, zero, and negative amounts.
- Reject duplicate references.
- Reject a second approval without changing totals.
- Temporarily break the spreadsheet credential, submit a unique practice record, confirm that it remains in Supabase with a failed sync status, restore the credential, and retry the same record.
- Confirm that a Telegram delivery failure does not undo a saved manager decision.
- Mark any instructor-added transaction as `Instructor test` (or use `/testsale` and `/testexpense`). Confirm that current totals change while the original homework-only company result remains €3,930.
