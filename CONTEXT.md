# Domain context

## traQ identity

A traQ identity is the one-to-one pair of a user's traQ ID and user UUID. Both values are stable, so a successfully verified pair may be cached for the lifetime of the process. A missing user or a failed lookup is not an identity and must remain retryable.

## Architecture

The backend dependency direction is `presentation/infrastructure -> application -> domain`. `App.kt` is the composition root and is the only place that wires concrete persistence and traQ adapters to application ports. Domain and application packages must not import Ktor, Trakt, sqlx4k, or platform APIs.

The frontend dependency direction is `app/routes -> features -> entities -> shared`. Route components own loading and mutable workflow state; feature APIs own endpoint details; poll selectors stay independent from React draft state; shared modules do not depend on poll features.
