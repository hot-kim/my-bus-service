# Static dev server that tells the browser not to cache, so edits show up on reload.
import functools
import http.server
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


handler = functools.partial(NoCacheHandler, directory=ROOT)
with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler) as httpd:
    print(f"Serving {ROOT} at http://localhost:{PORT}", flush=True)
    httpd.serve_forever()
