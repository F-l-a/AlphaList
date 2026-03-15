from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

if __name__ == "__main__":
    host = "0.0.0.0"
    port = 8000
    print(f"Serving on http://{host}:{port} with no-cache headers")
    ThreadingHTTPServer((host, port), NoCacheHandler).serve_forever()
