"""Local development server.

Serves the project folder at http://localhost:8000 and accepts POST /__save?path=<relative path>
so the in-browser tools (stimulus export, debug runs) can write files into sample_data/ or
experiment/stimuli/. Writes anywhere else are refused.

Usage:  python tools/dev_server.py   (from the project root)
"""
import http.server
import os
import socketserver
import sys
import urllib.parse

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
ALLOWED = [os.path.join(ROOT, 'sample_data'), os.path.join(ROOT, 'experiment', 'stimuli'),
           os.path.join(ROOT, 'audio_src', 'elevenlabs')]  # audio_review.html saves the take selection here
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        if u.path != '/__save':
            self.send_error(404)
            return
        rel = urllib.parse.parse_qs(u.query).get('path', [''])[0]
        dest = os.path.abspath(os.path.join(ROOT, rel))
        if not any(dest.startswith(a + os.sep) for a in ALLOWED):
            self.send_error(403, 'path not allowed')
            return
        n = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(n)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, 'wb') as f:
            f.write(body)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'ok')

    def log_message(self, fmt, *args):
        if '__save' in (str(args[0]) if args else ''):
            super().log_message(fmt, *args)


socketserver.TCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(('127.0.0.1', PORT), Handler) as httpd:
    print(f'Serving {ROOT} at http://localhost:{PORT}')
    httpd.serve_forever()
