# Demo API

All endpoints are `public/api.php?action=...`. Responses are JSON with `Cache-Control: no-store`. The API is disabled unless `TFT_DEMO_ENABLED=1`. Workspace identity comes from an HttpOnly SameSite Strict session cookie. Client supplied workspace IDs are not used.

## Reads

| Action | Result |
| --- | --- |
| bootstrap | Categories, CSRF token, effective personal settings, tags, administrator configuration state, statuses, transitions, priorities and fictional agents |
| settings, scope=user or system | Config, revision, systemRevision, inherited and scope |
| tickets | Up to 100 matching records, matched total and limit |
| ticket, id=… | One owned record, lifecycle state, latest 200 events and current handoff text |
| overview | Full workspace counts, active totals, unassigned count, workgroup counts, seed state and five recent records |
| activity | Latest 200 owned events with ticket summary, event type, note, changes and demo actor |

Tickets supports `q`, `status`, `priority`, `workgroup` and `assignee`. Search matches the captured JSON text or ticket ID and treats wildcard characters literally. `assignee=__unassigned` finds empty assignments. Results use operative lifecycle metadata and sort by most recent update.

Counts cover all tickets in a workspace, independent of list limits. Active means any status except Resolved. This is not an SLA or response time calculation.

## Writes

POST requires `X-CSRF-Token` from bootstrap. System scope additionally requires `X-TFT-Admin` matching the configured `TFT_ADMIN_TOKEN`. No system write permission is granted if the host token is absent or shorter than 32 characters.

POST settings accepts `{config, revision, systemRevision}`. Config contains fields, workgroups, formats and defaultFormat. POST reset in user scope accepts `{revision, systemRevision}` and resumes inheritance. Reset retains the monotonic personal revision and preserves tickets.

POST tickets and POST validate accept `{ticket, formatId, settingsRevision, systemRevision}`. Validate returns normalized fields and rendered text without saving. Tickets returns 201 and the new record. The receiving config is authoritative: unknown fields, answers, choices or workgroup codes and missing required values are rejected. New tickets start with Open status and revision 1, plus the original field, format and settings snapshot.

POST update accepts `{id, revision, status?, priority?, assignee?, workgroup?, note?}`. Only supplied fields change. Assignee is a fictional agent ID or an empty string. Priority is Low, Normal or High. Workgroup is a current code or empty when the ticket is not escalated. Notes are text of up to 4,000 bytes. Unknown workflow fields are rejected. See [Ticket workflow](workflows.md) for transition and reason requirements.

Every mutation compares the owned ticket revision inside an immediate SQLite transaction. A successful update increments the revision, saves operative metadata and appends a history event atomically. Original captured fields, output and settings snapshot remain unchanged. Standalone notes also increment the revision. A no change submission with no note is rejected.

POST seed accepts `{confirm:true}`. It creates ten fictional scenarios and their initial state in the current workspace, in one transaction with a seed marker. Retrying returns `added:0, alreadyLoaded:true`. Existing tickets and personal settings are preserved. Bootstrap does not mutate records; the frontend issues this POST when it detects a new empty workspace.

## Status codes and scope

Settings and ticket revision conflicts return 409. A missing or unowned detail or workflow update returns 404. Invalid data returns 422. CSRF or administrator failures return 403. Oversized bodies return 413; JSON requests are capped at 256 KB. Unknown actions or settings scopes return 404. Unsupported methods return 405.

All queue, detail, workflow, event and fixture operations are scoped to the session. A host administrator token grants system settings writes, not access to another session's tickets. Agents and event actor labels are demo fixtures, not authenticated staff accounts.

Settings and templates use text substitution only. There is no expression evaluation, SQL interpolation, HTML rendering or remote template loading. The browser renders imported and saved values as text.

## Public host profile

The hosted bridge uses the same API behind a dedicated `tft_session` cookie with a `/tft/` path. Bootstrap additionally returns `publicDemo` and `expiresAt`. The hosted profile locks system settings and applies the limits and expiry documented in [Hosted demonstration](HOSTING.md). Quota and rate limits return 429 with Retry-After. Capacity returns 503. Local defaults remain unchanged unless the profile is enabled.
