# Domain context

## traQ identity

A traQ identity is the one-to-one pair of a user's traQ ID and user UUID. Both values are stable, so a successfully verified pair may be cached for the lifetime of the process. A missing user or a failed lookup is not an identity and must remain retryable.
