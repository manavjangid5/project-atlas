import http from "http";

export function startHealthServer() {
  const port = process.env.PORT || 4001;
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "atlas-worker" }));
  });
  server.listen(port, () => {
    console.log(`Worker health server listening on port ${port}`);
  });
}