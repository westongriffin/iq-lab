"""Minimal static server for local preview (avoids os.getcwd, which the
sandboxed launcher cannot resolve)."""
import functools
import http.server

ROOT = "/Users/wesgriffin/Desktop/IQ"
Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
http.server.ThreadingHTTPServer(("127.0.0.1", 8123), Handler).serve_forever()
