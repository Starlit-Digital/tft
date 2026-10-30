# Ticket workflow

The modern frontend uses browser ES modules, Fetch, native inputs and dialogs, semantic navigation links and CSS layout. The persistent PHP backend is authoritative for ticket validation, routing, status changes, revisions and workspace scope. No historical application, internal endpoints or original records run in the demo.

## Navigation and queue

Top links switch between Overview, Tickets, New ticket, Escalations and Activity. Settings uses a separate page with the same navigation. Hash routes support browser Back, Forward and direct links. Switching workspace sections hides the inactive panel and retains the composer draft. Leaving a page with an unsaved compose or settings draft invokes the browser's unsaved change handling.

Counts on Overview include every ticket in the current workspace. Active means any status except Resolved. Workgroup bars count active tickets and do not represent service level agreements. Queue filters run on the server, with a limit of 100 newest matching tickets and an explicit total. Activity shows the latest 200 events. Counts are real database values; the underlying records are fictional demo data.

## Lifecycle

A new ticket starts Open, unassigned, with its captured workgroup. Operative priority is Low, Normal or High. A custom captured priority outside those values starts with Normal operative priority and retains its original field value in the captured ticket.

Allowed transitions:

| Current | Next |
| --- | --- |
| Open | In progress, Waiting, Escalated, Resolved |
| In progress | Open, Waiting, Escalated, Resolved |
| Waiting | Open, In progress, Escalated, Resolved |
| Escalated | In progress, Waiting, Resolved |
| Resolved | Open |

Escalation requires a reason and a current workgroup code. An agent may be assigned independently. Resolution and reopening require a reason. A resolved ticket must be reopened before routing or priority changes. Notes may be added without changing the status, including after resolution.

Every accepted mutation increments the ticket revision and writes a history event inside the same SQLite transaction. Unknown agents, invalid workgroups or transitions, empty updates and stale revisions are rejected. Failed changes roll back. A stale drawer retains its unsaved values and offers Reload ticket before retrying.

The ticket drawer edits operative workflow state, not the originally captured form. Current handoff output includes that state, the last escalation reason and original formatted text. The original fields, format snapshot and saved output remain immutable. Export original fields produces the captured values, not a rewritten routing history. Activity and current handoff provide the operative history.

## Demo identity and seed behavior

All agents are fictional and all events are attributed to Demo operator or Demo scenario. Choosing an assignee does not impersonate that person or send a notification. There are no external calls, email deliveries or real directory lookups.

Seed data is in `config/demo-tickets.json` and `config/demo-agents.json`. Loading it is a CSRF protected POST, with a workspace marker and all inserts in one transaction. Retrying does not add duplicates. No ticket deletion or reset endpoint is included. Fixtures use the shipped generic schema and preserve their own configuration snapshots, even if a session has personalized field settings.

Session scope is enforced on queue reads, detail reads, mutations and events. Knowing a ticket ID cannot read or modify another session's record. These are local demo boundaries, not staff accounts or organization permissions.

## Presentation and verification

The updated interface retains the Starlit Review bench composition, navy surfaces, restrained gold and teal accents and the canonical preferences center. Native section links remain available when a section is empty. Statuses include visible text as well as color. Narrow layouts stack cards and form rails; the top navigation wraps instead of hiding destinations.

Keyboard, contrast, shade, native focus containment, 320px rendering and 200% text still need real browser verification. The DOM suite tests logic, route visibility, filters, dialog workflows, history, compose saving, field editing and staged imports, without claiming layout or assistive technology verification.
