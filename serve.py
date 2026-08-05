#!/usr/bin/env python3
"""Benchsy dev server.

Identical to `python3 -m http.server`, except every response carries
no-store. The stdlib server sends only Last-Modified, which lets browsers
cache data.js and app.js heuristically — so edits to the board data don't
show up until a hard reload. Here they always do.

    python3 serve.py [port]

Port resolution: the CLI argument wins, then $PORT (set by the preview
harness, which assigns a free port), then DEFAULT_PORT.
"""

import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

DEFAULT_PORT = 4173


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()

    def send_header(self, keyword, value):
        # Drop the validators the stdlib adds, so a stale copy has nothing
        # to revalidate against and the browser always refetches.
        if keyword in ('Last-Modified', 'ETag'):
            return
        super().send_header(keyword, value)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get('PORT') or DEFAULT_PORT)
    handler = partial(NoCacheHandler, directory=os.path.dirname(os.path.abspath(__file__)))
    with ThreadingHTTPServer(('', port), handler) as httpd:
        print(f'Benchsy on http://localhost:{port}  (no-store: edits show on plain reload)')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nstopped')


if __name__ == '__main__':
    main()
