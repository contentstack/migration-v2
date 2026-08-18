#!/usr/bin/env python3
"""Tiny local server that accepts a connection and never responds — simulates
exactly the "slow CDN / hung endpoint" scenario the asset-fetch timeout fix
guards against. Run with: python3 hang-server.py [port]
"""
import http.server
import socketserver
import sys
import time

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123

class HangHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        print(f"[hang-server] connection accepted for {self.path} — never responding")
        time.sleep(3600)  # never actually reached in practice; the client times out first

    def log_message(self, format, *args):
        pass  # quiet — the print() above is enough

with socketserver.TCPServer(("127.0.0.1", PORT), HangHandler) as httpd:
    print(f"[hang-server] listening on http://127.0.0.1:{PORT} — Ctrl+C to stop")
    httpd.serve_forever()
