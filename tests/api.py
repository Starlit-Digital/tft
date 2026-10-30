"""Isolated HTTP checks. No real records or host configuration are used."""
import copy
import http.cookiejar
import json
import os
import secrets
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

with tempfile.TemporaryDirectory(prefix='tft-api-') as temp:
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    secret = secrets.token_hex(32)
    env = dict(os.environ, TFT_DEMO_ENABLED='1', TFT_ADMIN_TOKEN=secret, TFT_DB_PATH=str(Path(temp) / 'tickets.sqlite'))
    server = subprocess.Popen(['php', '-S', f'127.0.0.1:{port}', '-t', 'public'], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    base = f'http://127.0.0.1:{port}/api.php'
    def client():
        return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def request(who, action='bootstrap', body=None, csrf=None, admin=None, scope=None):
        headers = {}
        if body is not None: headers['Content-Type'] = 'application/json'
        if csrf: headers['X-CSRF-Token'] = csrf
        if admin: headers['X-TFT-Admin'] = admin
        req = urllib.request.Request(base + '?action=' + action + ('&scope=' + scope if scope else ''), data=json.dumps(body).encode() if body is not None else None, headers=headers)
        try:
            with who.open(req) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            return error.code, json.load(error)
    try:
        a, b = client(), client()
        for _ in range(60):
            try:
                code, boot = request(a)
                if code == 200: break
            except urllib.error.URLError: pass
            time.sleep(.05)
        else: raise RuntimeError('Test server did not start.')
        csrf = boot['csrf']
        _, other = request(b)
        config = boot['settings']['config']
        payload = {'config': config, 'revision': 0, 'systemRevision': 0}
        assert request(a, 'settings', payload)[0] == 403, 'CSRF must be required.'
        assert request(a, 'settings', payload, csrf, scope='system')[0] == 403, 'System settings must require admin access.'
        assert request(a, 'settings', payload, csrf, admin='invalid', scope='system')[0] == 403
        personal = copy.deepcopy(payload)
        personal['config']['formats'][0]['body'] = 'Personal: {{summary}} / {{workgroup.code}}'
        assert request(a, 'settings', personal, csrf)[0] == 200
        _, b_settings = request(b, 'settings')
        assert b_settings['inherited'] and b_settings['config'] == config, 'Personal settings leaked.'
        assert request(a, 'settings', personal, csrf)[0] == 409, 'Stale writes must conflict.'
        bad = copy.deepcopy(personal)
        bad['revision'] = 1
        bad['config']['formats'][0]['body'] = '{{private.secret}}'
        assert request(a, 'settings', bad, csrf)[0] == 422
        ticket = {'category': 'network', 'requester': 'Alex Example', 'summary': 'Demo issue', 'workgroup': 'NET-03', 'answers': {'scope': 'One device'}}
        body = {'ticket': ticket, 'settingsRevision': 1, 'systemRevision': 0, 'formatId': 'standard'}
        assert request(a, 'validate', body, csrf)[0] == 200
        _, empty = request(a, 'tickets')
        assert empty['tickets'] == [], 'Import preview must not save records.'
        code, saved = request(a, 'tickets', body, csrf)
        assert code == 201 and saved['formatted'] == 'Personal: Demo issue / NET-03'
        assert request(b, 'tickets')[1]['tickets'] == [], 'Tickets leaked between sessions.'
        bad_ticket = copy.deepcopy(body)
        bad_ticket['ticket']['unknown'] = 'Never silently discard me'
        assert request(a, 'validate', bad_ticket, csrf)[0] == 422
        assert request(a, 'settings', payload, csrf, admin=secret, scope='system')[0] == 200
        assert request(a, 'tickets', body, csrf)[0] == 409, 'Stale ticket settings must conflict.'
        code, reset = request(a, 'reset', {'revision': 1, 'systemRevision': 1}, csrf)
        assert code == 200 and reset['inherited']
        assert request(a, 'tickets')[1]['tickets'][0]['formatted'] == saved['formatted'], 'Saved output changed.'
        assert request(a, 'settings', scope='another-user')[0] == 404
        print('PASS HTTP administrator authorization, CSRF, settings isolation, stale writes, staged import validation and saved output preservation')
    finally:
        server.terminate()
        server.wait(timeout=5)
