# Domain context

## traQ identity

A traQ identity is the one-to-one pair of a user's traQ ID and user UUID. Both values are stable, so a successfully verified pair may be cached for the lifetime of the process. A missing user or a failed lookup is not an identity and must remain retryable.

## Architecture

The backend dependency direction is `presentation/infrastructure -> application -> domain`. `App.kt` is the composition root and is the only place that wires concrete persistence and traQ adapters to application ports. Domain and application packages must not import Ktor, Trakt, sqlx4k, or platform APIs.

The frontend dependency direction is `app/routes -> features -> entities -> shared`. Route components own loading and mutable workflow state; feature APIs own endpoint details; poll selectors stay independent from React draft state; shared modules do not depend on poll features.

## Scheduling candidates

An event uses one schedule type: `DATE_ONLY` or `TIMED`. A candidate is a date with either no times, or both a start and end time (minute precision). Its key is deterministic within an event: `YYYY-MM-DD` or `YYYY-MM-DD/HH:mm-HH:mm`. The server constructs the key; clients submit date/time fields when publishing and use returned keys when answering.

Every unanswered candidate defaults to `NO`, including newly added candidates for existing participants. A changed time is a new candidate; answers only carry over when the key is identical. Date-only events remain supported, and legacy events migrate to this type without changing their candidate keys or answers.

Bulk time settings replace the ranges on every selected date. Duplicate ranges can remain in the editing draft and are deduplicated on publication. In timed mode every selected date must have complete ranges; missing ranges show `未設定の日付があります！` in red, and publication is disabled until complete. End times must be later than start times within the same day, enforced by the editor and API. Invalid ordering shows `終了時間は開始時間より後にしてください`. Ranges are ordered by start time, then end time; the editor sorts when focus leaves the range editor so rows stay still during input.

With no selected dates, the time settings summary prompts the organizer to select dates. In timed mode, newly selected dates inherit the current common ranges when all selected dates have the same complete ranges. Each date receives its own editable copy, including when a previously removed date is selected again.

The approved UI is [ChoseiQun — White & Sky](https://www.figma.com/design/WUp3NLJARiXKUzyn5Rgsdb), including the date-only calendar and missing-time states. The CSS tokens, fonts and SVGs come from that file. Migration and API details are in [docs/timed-events.md](docs/timed-events.md).
