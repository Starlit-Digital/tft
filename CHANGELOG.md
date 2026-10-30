# Change history

## 0.2.0, October 30, 2026

First versioned source package for the modern service desk demo.

### Added

* Top navigation for Overview, Tickets, New ticket, Escalations, Activity and Settings, with browser history and retained compose state while switching sections.
* Workspace metrics, recent tickets, workgroup workload, searchable queues and status, priority, workgroup and assignee filters.
* Ten fictional ticket scenarios and four fictional agents. Empty sessions load the scenarios through a CSRF protected request. Existing records are preserved, and seeding is transactional and repeat safe.
* Persistent ticket assignment, operative routing, priority, status transitions, notes, escalation reasons, resolution and reopening.
* Revision checked workflow changes and append only event history, scoped to the owning demo session.
* Ticket detail drawer, current handoff copying, original field exports and preserved original output.
* Additive database upgrade for earlier installations, with migration preservation tests.
* Source package builder, per file manifest and SHA256 receipt, plus verification and full tests from the extracted package.
* Locked test dependencies and repository tests covering frontend DOM interactions, asset closure, ownership boundaries and lifecycle workflows.

### Changed

* Split the frontend into navigation, queue coordination, composer, ticket detail, presentation and transfer modules, using native browser APIs and external scripts.
* Refined the Starlit Review bench composition, shared navigation, mobile stacking, status hierarchy and accessibility preference integration.
* New ticket saves clear the compose form after successful persistence. Navigating between workspace sections retains an unsaved draft.
* Removed the duplicate fixed formatter. Named templates now drive both browser preview and every new saved output.
* Kept personal and system field settings, stable tags, workgroup directory, format editing and staged JSON or tagged text transfer.

### Verification limits

Backend, HTTP, template parity, migration, package and DOM interaction checks are automated. DOM simulation does not verify browser layout, native dialog focus containment, clipboard permissions or assistive technology. Real browser visual verification remains pending because local browser access is disabled in Work settings. This source has not been publicly deployed.

## Earlier source milestones

* `1e555f2`: recovered the original tool privately and created the generic ticket scaffold. No recovered records or original application files were added to the repository.
* `a9ab7bd`: added the field and output template editor, personal and administrator protected system settings, revision checks, workgroup directory and staged transfer formats.

These were source milestones without published package versions. The recovered original remains outside Git. Change history describes the generic implementation, not a publication of the historical internal system.
