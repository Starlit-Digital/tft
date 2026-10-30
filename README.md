# TFT

A generic ticket workspace, based on the workflow of the owner's historical ticket formatting tool. This first scaffold keeps most interaction in the browser and adds a small PHP persistence boundary.

## Run locally

Requires PHP 8.2 or later with PDO SQLite. Node is needed only for formatter tests.

```sh
make test
make serve
```

Open http://127.0.0.1:8094. Only `public/` is the web root. The launcher enables the demo API explicitly. The API otherwise returns 503. Storage defaults to `var/tickets.sqlite`, outside the web root and excluded from Git. `TFT_DB_PATH` can select another private location.

## Included

* Four generic issue categories with category specific questionnaires.
* Immediate text preview, clipboard copying and manual copy fallback.
* Server validation and authoritative saved formatting.
* SQLite submissions and a session scoped saved ticket list, forming the first administration scaffold.
* Session isolation, CSRF checks, bounded requests and safe text rendering.
* Fictional example data only. No original application code, credentials, records, branding or internal endpoints were imported.

The session cookie identifies a private demo workspace, not a staff account. New browser sessions cannot retrieve old tickets. Copying a ticket does not save it. Saving does not clear the form. The current list shows up to 100 newest tickets.

## Scope and next steps

This is an initial local scaffold. It has not been publicly deployed. It is not yet a multiuser helpdesk product. Full administration needs sign in, authorization roles, assignment, status history, search, audit records, retention and abuse controls. Public demo hosting also needs an isolated workspace lifecycle and automatic cleanup. Do not use real support records in this version.

The core historical flow has been examined. Full archive inventory and automated sensitive content triage are complete; manual review of every historical file and nested archive is pending. See `docs/recovery.md` for the recovery boundary and `docs/roadmap.md` for the next stages.

## Presentation status

The current interface is a functional wireframe. The Starlit library and Apple HIG foundation, text field and button guidance informed semantic labels, focus feedback, plain text output and responsive stacking. A finished SiteCraft composition, shared preferences center, light theme, approved TFT monogram and full visual accessibility review are deferred to the design pass. No template adoption or completed design audit is claimed.

DYWS integration is deferred. The scaffold has no ordering, catalog or payment requirement. No external service, email destination or deployment target is configured.

## Source

Private repository: https://github.com/Starlit-Digital/tft

## Verification

PHP persistence and validation tests, all category browser/server formatter parity checks, and HTTP bootstrap, CSRF rejection, save/list and workspace isolation checks passed locally. Browser visual and interaction verification remains pending because local browser access is disabled in the current Work settings.
