.PHONY: serve test package verify-package
serve:
	TFT_DEMO_ENABLED=1 php -S 127.0.0.1:8094 -t public
test:
	php tests/tickets.php
	php tests/settings.php
	php tests/workflow.php
	node tests/templates.mjs
	node tests/preferences.mjs
	python3 tests/api.py
	node tests/ui.mjs
	python3 tests/assets.py

package:
	python3 scripts/build-package.py

verify-package:
	python3 scripts/verify-package.py
