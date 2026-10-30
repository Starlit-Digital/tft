.PHONY: serve test
serve:
	TFT_DEMO_ENABLED=1 php -S 127.0.0.1:8094 -t public
test:
	php tests/tickets.php
	php tests/settings.php
	node tests/formatter.mjs
	node tests/templates.mjs
	python3 tests/api.py
