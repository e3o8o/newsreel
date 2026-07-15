# <Project> shipping report — YYYY-MM-DD

<One or two sentences: the headline of this cycle. What a reader who only reads this line
should take away. Name the biggest thing that reached production.>

Demo video: `<videoDir>/YYYY-MM-DD/<video>.mp4` (poster: `thumbnail.jpg`)

## Shipped to production

Two buckets, kept separate on purpose. "Already live" and "ships with this promotion" are
different states, and merging them misleads the reader.

### Already in production (since the last report)

| Item | Issue | PRs |
| --- | --- | --- |
| <what a user can now do> | <ID> | <#n → #n → #n> |

### Shipping with this promotion

| Item | Issue | PRs |
| --- | --- | --- |
| <what a user can now do> | <ID> | <#n> |

Write these as user-visible outcomes, not commit subjects. "Line amounts can be corrected
on an invoice" beats "fix update-item schema".

## Queued (built, not yet shipped)

| Item | Issue | Where it is | Ships |
| --- | --- | --- | --- |
| <item> | <ID> | <branch / open PR> | <next cycle> |

## Blocked

| Item | Blocker | Owner | Since |
| --- | --- | --- | --- |
| <item> | <the actual dependency> | <who can unblock> | <date> |

An item without a named blocker and owner is not blocked, it is just not started. Say so.

## Decisions and notes

- <Decisions taken this cycle that change scope or approach, and why.>
- <Anything the reader must act on: DDL to apply, env var to set, a call needed.>

## Next cycle

<The plan in one short list. What is committed vs conditional, and on what.>

---

Screenshots: capture with BetterShot (region/window, then beautify: background, padding,
radius, shadow), export PNG, drop under `images/`.
