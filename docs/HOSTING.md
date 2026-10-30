# Hosted demonstration

The public tft demonstration lives at https://sltd.ca/tft/. Its source repository is https://github.com/Starlit-Digital/tft and is public. The site links tft from its Developer tools section. The header identifies it as a demonstration, asks for fictional data only and links to the repository.

## Split layout

Only `public/` assets and the deployment API bridge belong under `public_html/tft`. PHP modules and generic schemas are deployed to a private versioned release directory outside the document root. A private `current` link selects the active source. Runtime data, error logs, rate secrets and PHP session files are in private host directories and are never packaged as source.

The bridge in `deploy/hostinger/api.php` resolves the domain directory, loads the private host policy and then the selected release's `src/Http.php`. For a different host or URL mount, adapt the bridge and cookie path explicitly. Local `public/api.php` continues to load the same HTTP implementation directly.

The Hostinger folder handler selects PHP 8.2 for tft without changing the parent website's PHP version. See the provider's [per folder PHP handler documentation](https://www.hostinger.com/support/4047803-how-to-change-the-php-version-for-subfolders-or-subdomains-in-hostinger/). The child `.htaccess` disables directory listings, selects the index document, prevents cache mismatches and marks API and settings responses noindex. The main page is indexable with its canonical URL; settings and session records are not search destinations.

## Private host policy

Enable the application with `TFT_DEMO_ENABLED=1` and its public limits with `TFT_PUBLIC_DEMO=1`. Set `TFT_COOKIE_PATH=/tft/`, a private `TFT_DB_PATH`, a random `TFT_RATE_SECRET` of at least 32 characters and a private session save path. The production policy is generated on the host and is outside Git. Do not place its values in deployment receipts.

Sessions use the separate `tft_session` name, HttpOnly and SameSite Strict, and Secure over HTTPS. A fixed session workspace expires after 24 hours. On the next request it receives a fresh workspace and CSRF token. Expired records, history, personal settings and seed markers are purged lazily during subsequent API traffic. Quiet sites can retain expired bytes until traffic resumes; an expired workspace is not reopened to the visitor.

The public installation allows up to 200 active workspaces, 50 tickets and 400 history events per workspace, with a one MB data budget. It limits API traffic to 180 requests per minute per hashed client address and 40 writes per minute per workspace. It stores no raw client address in its rate table and does not trust forwarded address headers. The generic source defaults do not enable these public host limits until explicitly configured.

System settings are always read only in public demo mode, including if a host administrator token is supplied. Visitors may customize their own session settings. Everything is fictional; this is not a real support intake endpoint or a staff account system.

## Deployment and rollback

Build and test the full source package. Stage private modules, generic config and browser assets. Preserve the private database and policy on upgrades. Back up the exact public site files outside the document root and compare their digests immediately before replacement. Local unpublished website edits must not be uploaded as an incidental deployment.

Select the private release and publish the matching public assets together. Check PHP version and SQLite, canonical redirects, API bootstrapping, sample seeding, session isolation, personal settings, locked system settings, transfer, escalation and asset digests through public HTTPS. Remove temporary probes. Keep receipts free of cookies, CSRF tokens and secrets.

Rollback restores the scoped public before images and the previous private release link. Do not restore a database over newer user records. Deployment does not publish the recovered original archive or any historical records.
