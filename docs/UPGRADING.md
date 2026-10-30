# Installing and upgrading the source package

## Fresh local installation

Unzip the source package. Serve only `public/` with PHP 8.2 or later and PDO SQLite enabled:

```sh
make serve
```

Open http://127.0.0.1:8094. The runtime uses native browser modules and needs no JavaScript dependency installation or frontend build. The local launcher explicitly enables the demo API. Opening the HTML directly as a file is not supported.

A new empty session loads ten fictional scenarios into its own private workspace. Existing sessions with tickets are left intact; their Load sample tickets button can append the same scenario set once. Agent names are fictional assignment targets, not signed in staff or delivery recipients.

## Upgrade from earlier TFT source

Stop the PHP process. Back up the private SQLite database and any host configuration outside the web root before replacing program files. Replace source and public assets together. Keep `var/`, any configured `TFT_DB_PATH`, session storage and secrets. Never upload runtime records or configuration into Git.

At the next API request, an additive transaction checks the stored schema, adds the nullable snapshot column if needed, creates workflow and event tables, and gives existing tickets Open status and a baseline history event. It does not rewrite original field values, formatted output or existing settings. Repeated initialization does not duplicate metadata or events.

Deploying only a new frontend against an older API, or only a new API against an older frontend, is unsupported. Existing source defaults are shipped in `config/`; runtime personal and system overrides remain in SQLite. Private test or host data is excluded from source packages.

The source package is not a production hosting installer. Real staff authentication, organization isolation, expiry, quotas, abuse controls and operational backups still need a production design. The host administrator capability protects system settings, while everyday tickets remain scoped to the demo session.

## Tests and package checks

Tests require PHP, Python 3.9 or later and Node.js 26 or a compatible LTS version listed in `package.json`. Install the locked development dependencies and run:

```sh
npm ci --ignore-scripts
make test
```

The jsdom dependency is used only for DOM tests. It is not loaded or served by the application. The full suite starts isolated PHP processes and temporary databases, without touching the live local demo database.

Maintainers working from a clean committed Git checkout can build and verify:

```sh
make package
make verify-package
```

The builder archives the complete committed source and excludes runtime data, original recovery files, secrets, dependencies and generated distributions. It writes `dist/tft-0.2.0-source.zip` and its SHA256 receipt. Every package contains `PACKAGE-MANIFEST.json` with the version, source commit and each file's size and SHA256. It refuses an uncommitted checkout so the manifest identifies an immutable source state.

Verification checks all entries and digests, extracts into a temporary directory, runs `npm ci --ignore-scripts` there and runs the entire suite from that extracted source. The package and receipt remain local artifacts; this does not upload or publish a release. GitHub source downloads receive the same committed runtime, fixtures, assets, tests and documentation, while `make package` additionally supplies a manifest.

A source ZIP without Git history can still run the app and tests. Building another immutable source package requires a Git checkout.
