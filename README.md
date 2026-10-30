# TFT

A configurable ticket workspace based on the owner's historical ticket formatting workflow. Most interaction runs in the browser, with a PHP validation and SQLite persistence boundary.

## Run locally

Requires PHP 8.2 or later with PDO SQLite. Node and Python 3 are needed for tests.

```sh
make test
make serve
```

Open http://127.0.0.1:8094. Settings and the field editor are at http://127.0.0.1:8094/settings.html.

Only `public/` is the web root. The launcher enables the demo API explicitly. The API otherwise returns 503. Storage defaults to `var/tickets.sqlite`, outside the web root and excluded from Git. `TFT_DB_PATH` can select another private location. `TFT_ADMIN_TOKEN` enables authenticated system settings writes when the host configures a token of at least 32 characters. Personal settings work without that token.

## Included

* Configurable fields, labels, dropdown choices, required flags, order and column width.
* Generic workgroup codes and names, plus four issue category questionnaires.
* Named output templates with a tag picker, live preview, duplication and default selection.
* Personal session settings, inherited system defaults and administrator protected shared settings writes.
* Draft undo, explicit discard controls and conflict detection across browser windows.
* Ticket preview, clipboard copying and plain text downloads.
* Versioned JSON and tagged text ticket import/export, with a validation preview before replacing the draft.
* Saved submissions, original output and settings snapshots, with session scoped ticket browsing.
* Shared Starlit accessibility preferences and dark default presentation.

Use fictional information only. No original code, credentials, records, corporate branding or internal endpoints were imported. See [Field editor](docs/field-editor.md) for behavior, tag syntax, API scope and tested limits.

## Scope

This is a local demonstration, not a publicly deployed helpdesk. The session cookie identifies a private demo workspace, not a staff account. New sessions cannot retrieve prior sessions' tickets or personal settings. System settings are shared across the installation and require the configured host administrator token to write.

Full administration still needs staff sign in, roles, assignment, status history, search, audit records, retention and abuse controls. Public demo hosting needs an isolated workspace lifecycle, expiry and quotas. No external service, email delivery or deployment target is configured.

The core historical flow has been examined. Full inventory and automated sensitive content triage are complete; manual review of every historical file remains pending. See [Recovery](docs/recovery.md), [Datastore](docs/datastore.md) and [Roadmap](docs/roadmap.md).

## Presentation and verification

The editor adapts the DYWS Order forms interaction pattern and the Starlit Review bench workspace composition. Palette tokens and the full preferences center come from the shared Starlit library. Asset digests, attribution and Apple HIG web adaptations are documented with the field editor.

Backend, transfer, renderer parity, authorization and HTTP tests pass. A DOM interaction smoke test passes. Real browser visual and accessibility verification is pending because local browser access is disabled in Work settings. No accessibility certification is claimed.

DYWS runtime integration is deferred. TFT has no ordering, catalog or payment requirement.

Private source repository: https://github.com/Starlit-Digital/tft
