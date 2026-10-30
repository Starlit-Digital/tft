"""Exercise the deployed split public/private layout and public demo policy."""
import http.cookiejar
import json
import os
import secrets
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='tft-hosted-') as temp:
    domain = Path(temp)
    public = domain/'public_html'/'tft'; public.parent.mkdir()
    shutil.copytree(ROOT/'public', public)
    shutil.copyfile(ROOT/'deploy/hostinger/api.php', public/'api.php')
    private = domain/'private'/'tft'/'current'; private.mkdir(parents=True)
    for name in ['src','config']: shutil.copytree(ROOT/name, private/name)
    (private.parent/'host.php').write_text('<?php\n')
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0)); port=sock.getsockname()[1]
    env=dict(os.environ,TFT_DEMO_ENABLED='1',TFT_PUBLIC_DEMO='1',TFT_COOKIE_PATH='/tft/',TFT_RATE_SECRET=secrets.token_hex(32),TFT_ADMIN_TOKEN=secrets.token_hex(32),TFT_DB_PATH=str(domain/'private'/'data.sqlite'))
    server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(public.parent)],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    base=f'http://127.0.0.1:{port}'
    def client(): return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    a,b=client(),client()
    def call(who,action,body=None,csrf=None,scope=None):
        headers={'Content-Type':'application/json'}
        if csrf:headers['X-CSRF-Token']=csrf
        headers['X-TFT-Admin']=env['TFT_ADMIN_TOKEN']
        request=urllib.request.Request(base+'/tft/api.php?action='+action+('&scope='+scope if scope else ''),data=json.dumps(body).encode() if body is not None else None,headers=headers)
        try:
            response=who.open(request);return response.status,json.load(response),response.headers
        except urllib.error.HTTPError as error:return error.code,json.load(error),error.headers
    try:
        for _ in range(80):
            try:
                code,boot,headers=call(a,'bootstrap')
                if code==200:break
            except urllib.error.URLError:pass
            time.sleep(.03)
        else:raise RuntimeError('Hosted test server failed to start.')
        assert boot['publicDemo'] and boot['expiresAt']
        assert 'tft_session=' in headers['Set-Cookie'] and 'path=/tft/' in headers['Set-Cookie'].lower()
        csrf=boot['csrf']
        assert call(a,'seed',{'confirm':True},csrf)[1]['added']==10
        assert call(a,'seed',{'confirm':True},csrf)[1]['added']==0
        assert call(a,'overview')[1]['total']==10
        assert call(b,'overview')[1]['total']==0
        settings=boot['settings']
        body={'config':settings['config'],'revision':settings['revision'],'systemRevision':settings['systemRevision']}
        assert call(a,'settings',body,csrf,scope='system')[0]==403, 'Shared settings stay locked even with an admin token.'
        assert call(a,'settings',body,csrf)[0]==200, 'Personal editor works on the public host.'
        assert not (public/'src').exists() and not (public/'config').exists()
        assert (domain/'private'/'data.sqlite').exists()
        print('PASS hosted public/private bridge, scoped cookie, isolated demo data, expiry metadata and locked system settings')
    finally:server.terminate();server.wait(timeout=5)
