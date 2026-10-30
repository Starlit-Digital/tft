# Ticket field and format editor

Open `settings.html` from the ticket workspace. This implements a configurable ticket form, named text output templates, a workgroup directory and scoped settings persistence.

## Design source

The owner's DYWS Order forms editor is the interaction reference: available fields, property controls, preview, named formats, undo, protected essential fields and revision checked saves. Source read from `dyws/docs/order-format.md`, `public_html/plugins/order-format/model.js`, `editor.js` and `plugins/order-format/Templates.php`. No DYWS ordering code or dependencies were copied into TFT.

The recovered TFT location suggestion code fills a site code, workgroup code and routing comment. Its separate troubleshooting dropdown inserts reusable issue snippets. Those are separate interactions. This version adds a generic coded workgroup dropdown; it does not copy the original directory or claim to restore the absent database.

The Starlit Review bench composition, slug `calibre-grading-bench-page`, is the visual reference for a bordered workspace, source and output panels, compact state indicators and restrained gold and teal accents. The settings workspace adapts it to a field list, form canvas and property rail. It does not import the fictional marketing claims, gauge or animation. Shared palette tokens and the canonical full preferences center are copied from the Starlit library; digests are in `asset-provenance.json`. Library attribution: https://instalanding.ai/p/calibre-grading-bench-page.txt, declared MIT in the source collection. Preserve the original library notices if importing more template source later.

Apple HIG foundation, settings, entering data, text field and button guidance informed semantic controls, readable labels, logical keyboard order, explicit status messages and responsive stacking. These are web adaptations, not native measurements or certification. The page defaults to dark and includes the canonical shade slider, contrast, typography, focus and motion preferences. No new product icon was created.

## Fields

Each field has a stable lowercase tag, a display label, a type, required state and a one or two column span. Fields render in their saved order. Move up and Move down support keyboard operation. Available types are single line, multiple lines, dropdown and the dedicated workgroup lookup. Workgroup lookup uses code and display name pairs.

Summary and requester remain required text fields. Their tags cannot change. Existing tags are immutable; add a new field for a different identity. Other fields may be removed after their direct tags are removed from templates. Limits are 40 fields, 50 choices per dropdown, 100 workgroups and 20 output formats. Field values and questionnaire answers are bounded separately.

Issue category questionnaires remain the four generic schemas in `config/categories.json`. Their question definitions are not edited through this page yet. Field configuration edits the surrounding ticket form.

## Output tags

Use double braces around a known tag. The tag picker inserts at the text cursor.

```text
{{summary}}
Requester: {{requester}}
Route to: {{workgroup.code}} / {{workgroup.name}}

{{answers}}

Actions taken:
{{troubleshooting}}
```

Each configured field exposes its tag, such as `{{reference}}`. Built in derived tags include `{{category.label}}`, `{{workgroup.code}}`, `{{workgroup.name}}` and `{{answers}}`. Individual questionnaire answers use tags such as `{{answers.steps}}`. An answer tag for another category resolves to empty text.

Templates preserve their whitespace and insert values once. Tags in a submitted value stay literal. Unknown tags and unbalanced braces prevent saving. HTML, expressions, scripts, loops, executable filters and external calls are not evaluated. The UI renders all output as text. Choosing a format changes the preview; saving a ticket uses the same format on the server.

The editor has named formats, duplication, a default format, live sample output and a desktop or phone form preview. Undo restores draft changes. Reload and scope changes require an explicit discard when unsaved changes exist.

## Personal and system scopes

My workspace saves a complete independent configuration for the current demo session. Until the first personal save, it inherits the latest system defaults. Once saved, it remains stable as system defaults change. Use system defaults removes that personal override and resumes inheritance. It does not delete tickets.

System defaults are shared. Reading generic defaults is allowed; changing them requires CSRF and an administrator token configured in the PHP process as `TFT_ADMIN_TOKEN`, at least 32 characters long. Enter that token in the password field on the System defaults pane. The editor sends it only in the request header, never in the URL, JSON settings, database or browser storage. The default local launcher leaves system saving locked unless the host supplies this environment variable. Configure it through the host's secret handling, outside Git.

This is a demo session identity and a host administrator capability. It is not a staff account system, password login, organization tenancy model or full role management. Shared defaults therefore belong to one local installation. Real account lifecycle and permission management remain a later stage.

Settings use SQLite outside the public root. Both scopes use revision checked writes inside a database transaction. A stale edit returns HTTP 409. A composer with stale settings must export its draft before reload. No stale request silently overwrites another window's settings.

## Transfer formats

JSON exports use a versioned envelope:

```json
{"version":1,"ticket":{"category":"access","summary":"Example issue","requester":"Alex Example","answers":{"service":"Demo service","message":"Access unavailable","lastWorked":"Yesterday"}}}
```

Tagged text uses `TFT-TAGS/1` followed by stable field tags and JSON encoded values, one per line. A multiline value is encoded with newline escapes so it round trips without interpreting a label inside the value as another field.

```text
TFT-TAGS/1
category: "access"
summary: "Example issue"
requester: "Alex Example"
answers: {"service":"Demo service","message":"Access unavailable","lastWorked":"Yesterday"}
```

Export JSON downloads the draft. Export tagged text fills the transfer box for copying. Saved tickets can export their original structured fields. Download output writes the chosen human readable template output as plain text.

Import accepts JSON or tagged text from a file or clipboard paste. Review import parses it, rejects unknown fields or workgroup codes, validates it on the server and displays an output preview. Replace draft with import explicitly applies the validated values. Neither step saves a ticket. Choose Save demo ticket separately. No imported schema or executable template is applied automatically. File input is capped at 128 KB.

Arbitrary prose, CSV, spreadsheets and reverse parsing of customized output templates are not supported yet. Use a transfer export for a lossless round trip. Importing a saved ticket with custom fields into a differently configured workspace requires defining those fields first. Exported tickets do not modify the receiving workspace's settings.

## Saved records and verification

Every new ticket saves normalized field values, its exact output and the active settings and selected format snapshot. Later template edits do not rewrite historical records. Existing tickets are preserved by adding a nullable snapshot column; older records keep their saved text and have no retroactively invented snapshot.

`make test` covers persistence, settings inheritance, workspace isolation, revision conflicts, required fields, invalid workgroups, unknown tags, exact whitespace, all category and format browser/server parity, multiline JSON and tagged text round trips, administrator authorization, CSRF and staged import without saving. A DOM smoke test additionally exercised adding a custom field, editing its template, saving personal settings, composing, previewing, reviewing an import and saving its ticket.

Real browser visual inspection, narrow viewport layout, keyboard focus traversal, clipboard permissions, shade/contrast behavior and assistive technology verification remain pending because local browser access is disabled in the current Work settings. DOM simulation is not visual verification. Public deployment remains outside this change.
