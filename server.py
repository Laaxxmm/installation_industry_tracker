"""SAB India Tracker — static-file server for Railway.

Serves the single-file HTML demo (SAB India Tracker.html) on $PORT.
Root URL ('/') 302-redirects to the HTML so the app loads on the bare
deployment domain.
"""

import os
import http.server
import socketserver
from urllib.parse import quote

PORT = int(os.environ.get("PORT", "8000"))
HTML_FILE = "SAB India Tracker.html"


class Handler(http.server.SimpleHTTPRequestHandler):
    # SimpleHTTPRequestHandler reads files from the cwd. We bind it to the
    # repo root by running this script from the repo root in the Dockerfile.

    def end_headers(self):
        # Permissive CORS so the page works behind Railway's edge.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):
        if self.path in ("/", "/index.html", ""):
            self.send_response(302)
            self.send_header("Location", "/" + quote(HTML_FILE))
            self.end_headers()
            return
        return super().do_GET()


def main():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
        print(f"SAB India Tracker serving on 0.0.0.0:{PORT}", flush=True)
        httpd.serve_forever()


if __name__ == "__main__":
    main()
