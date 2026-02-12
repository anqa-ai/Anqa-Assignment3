#!/usr/bin/env python3
"""
Simple review server.
- Serves static files from repository root
- Handles POST /decision (JSON) to record decisions and, on approve, runs merge_and_push.sh
Run: python3 review_server.py
"""
import http.server, socketserver, json, os, subprocess, urllib.parse, sys, datetime

PORT = 8080
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))  # repo root
ARTIFACTS_DIR = os.path.join(ROOT, "interface-ci", "artifacts")
REVIEWS_DIR = os.path.join(ROOT, "interface-ci", "reviews")
MERGE_SCRIPT = os.path.join(ROOT, "interface-ci", "merge_and_push.sh")

os.makedirs(REVIEWS_DIR, exist_ok=True)

class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # serve files relative to repo root
        path = path.split('?',1)[0]
        path = path.split('#',1)[0]
        trailing = path.lstrip('/')
        full = os.path.join(ROOT, trailing)
        return full

    def do_POST(self):
        if self.path == "/decision":
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            try:
                data = json.loads(body)
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"Invalid JSON")
                return

            # add timestamp and write audit file
            ts = datetime.datetime.utcnow().isoformat() + "Z"
            data['timestamp'] = ts
            fname = f"review_{data.get('tagB','unknown')}_{ts.replace(':','-')}.json"
            path = os.path.join(REVIEWS_DIR, fname)
            with open(path, 'w') as f:
                json.dump(data, f, indent=2)

            # If approve, run merge script (synchronously) and capture output
            if data.get('decision') == 'approve':
                try:
                    # Call merge script and capture output
                    env = os.environ.copy()
                    env['REVIEWER'] = data.get('reviewer','local')
                    proc = subprocess.run([MERGE_SCRIPT, data.get('tagB')], cwd=ROOT, env=env,
                                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=300)
                    out = proc.stdout
                    status = proc.returncode
                    resp = {"status": "merge_script_exited", "code": status, "output": out}
                except subprocess.TimeoutExpired:
                    resp = {"status":"error","message":"merge script timed out"}
                except Exception as e:
                    resp = {"status":"error","message":str(e)}
                self.send_response(200)
                self.end_headers()
                self.wfile.write(json.dumps(resp, indent=2).encode('utf-8'))
                return
            else:
                # reject or other
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b"Decision recorded")
                return
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not Found")

if __name__ == "__main__":
    os.chdir(ROOT)
    print(f"Serving files from {ROOT} on port {PORT}")
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("Shutting down")
            httpd.shutdown()
            