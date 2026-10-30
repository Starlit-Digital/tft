# Demo API

All endpoints are `public/api.php?action=...`. Responses are JSON with `Cache-Control: no-store`. The API is disabled unless `TFT_DEMO_ENABLED=1`. The server owns workspace identity through an HttpOnly SameSite Strict session cookie. Client supplied workspace IDs are never used.

GET bootstrap returns categories, CSRF token, effective personal settings, supported tags and whether system administration is configured. GET settings accepts scope=user or scope=system and returns config, revision, systemRevision, inherited and scope. GET tickets returns the current workspace's 100 most recent records.

POST requires `X-CSRF-Token` from bootstrap. System scope additionally requires `X-TFT-Admin` matching the configured `TFT_ADMIN_TOKEN`, with no permission granted if the server token is absent or shorter than 32 characters.

POST settings accepts `{config, revision, systemRevision}`. Config contains fields, workgroups, formats and defaultFormat. POST reset in user scope accepts `{revision, systemRevision}` and resumes inheritance. Reset retains the monotonic personal revision.

POST tickets and POST validate accept `{ticket, formatId, settingsRevision, systemRevision}`. Validate returns the normalized ticket and rendered text without saving. Tickets returns 201 and a stored record with id, created_at, ticket, formatted and spec. Spec contains the active config and formatId. The receiving config is authoritative. Unknown fields, unknown answers, invalid choices, invalid workgroup codes and missing required values are rejected.

Settings updates use an immediate SQLite transaction and compare both revisions before writing. Revision conflicts return 409. Stale composer settings also return 409 to preserve schema meaning. Invalid data returns 422, CSRF or administrator failures return 403, oversized request bodies return 413, unknown actions or scopes return 404, and unsupported HTTP methods return 405. JSON request bodies are capped at 256 KB.

Source settings are generic configuration, not record imports. Configuration tags accept known text substitutions only. No expression evaluation, SQL interpolation, HTML rendering or remote template loading is supported.
