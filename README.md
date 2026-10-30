# TFT

A modern demonstration service desk built around configurable ticket fields and useful handoffs. Native browser modules handle the interface; PHP and SQLite own validation, settings, ticket state and history.

## Run the demo

Requires PHP 8.2 or later with PDO SQLite. The application has no frontend build or runtime JavaScript dependencies.

```sh
make serve
```

Open http://127.0.0.1:8094. The first empty session loads ten fictional tickets and four fictional assignment agents. Existing tickets stay intact.

Only `public/` is the web root. The local launcher sets `TFT_DEMO_ENABLED=1`; otherwise the API returns 503. Storage defaults to private `var/tickets.sqlite`. `TFT_DB_PATH` can select another location. A host configured `TFT_ADMIN_TOKEN` of at least 32 characters enables system settings writes. Personal settings do not require that token.

## Workspace

* Overview with real workspace totals, recent tickets, active workgroup counts and attention indicators.
* Tickets with search and status, priority, workgroup and assignee filters.
* New ticket with configurable fields, workgroup lookup, category questionnaires and live tagged output.
* Escalations with a destination, reason, current handoff and specialist assignment.
* Activity with recorded notes, routing, status changes, resolution and reopening.
* Settings with field definitions, order and width, dropdown choices, named output templates, undo, live previews and personal or administrator protected shared defaults.
* Structured JSON and tagged text imports, reviewed before replacing a draft, plus field exports and plain text handoff copying.
* Persistent workflow revisions, atomic changes, session isolation and preserved original output and settings snapshots.
* Dark default presentation, responsive layouts and the shared Starlit accessibility preferences center.

All sample people, agents, assets and scenarios are fictional. Assignment does not send messages. No original application files, internal endpoints, credentials or historical records were imported into the source.

## Source package and change history

Every runtime file, fixture, asset, schema, test and setup instruction is tracked in this repository. The same committed source is available through GitHub downloads. [Change history](CHANGELOG.md) records the work, and [Installing and upgrading](docs/UPGRADING.md) explains preservation of older databases.

For tests, install the locked development dependency with Node.js 26 or a compatible LTS version listed in `package.json`, then run:

```sh
npm ci --ignore-scripts
make test
```

Tests also need Python 3.9 or later. They use isolated PHP processes and temporary databases. jsdom is a development dependency only, used for DOM interactions.

From a clean committed Git checkout:

```sh
make package
make verify-package
```

The source ZIP, per file commit manifest and SHA256 receipt are written to ignored `dist/`. Package verification extracts the archive, installs locked test dependencies and runs the complete suite from the extracted copy. Generated distributions, dependencies, runtime databases, secrets and recovered originals stay outside Git. Building a package does not publish it.

## Scope and verification

This is a local demo, not a publicly deployed helpdesk. A session cookie identifies its workspace; new sessions cannot retrieve old sessions' records or personal settings. Fictional agents simulate assignment. Staff authentication, organization permissions, notifications, retention, quotas and production operations remain future work.

Backend, HTTP, template parity, migration, ownership, DOM workflow, asset and extracted package checks are automated. Real browser visual, keyboard, shade, clipboard and assistive technology verification is pending because local browser access is disabled in Work settings. DOM simulation is not layout or accessibility certification.

The interface adapts the Starlit Review bench composition and the DYWS Order forms editing pattern. Shared asset origins and the local host font adaptation are recorded in [asset provenance](docs/asset-provenance.json). DYWS runtime integration is not present; TFT has no ordering or payment requirement. No email service or public hosting target is configured.

Read [Ticket workflow](docs/workflows.md), [Field editor](docs/field-editor.md), [API](docs/api.md), [Recovery](docs/recovery.md), [Datastore findings](docs/datastore.md) and [Roadmap](docs/roadmap.md).

Private source repository: https://github.com/Starlit-Digital/tft
