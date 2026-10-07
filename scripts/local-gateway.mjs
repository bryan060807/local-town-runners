import http from "node:http";
const server = http.createServer((req, res) => {
  const auth = req.url.startsWith("/auth/v1/"),
    rest = req.url.startsWith("/rest/v1/");
  if (!auth && !rest) {
    res.writeHead(404);
    res.end();
    return;
  }
  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: auth ? 54325 : 54326,
      path: req.url.replace(auth ? "/auth/v1" : "/rest/v1", ""),
      method: req.method,
      headers: {
        ...req.headers,
        host: auth ? "127.0.0.1:54325" : "127.0.0.1:54326",
      },
    },
    (r) => {
      res.writeHead(r.statusCode, r.headers);
      r.pipe(res);
    },
  );
  upstream.on("error", () => {
    res.writeHead(503);
    res.end("Local backend unavailable");
  });
  req.pipe(upstream);
});
server.listen(54321, "127.0.0.1", () =>
  console.log(
    "Local integration gateway listening; credentials are not logged.",
  ),
);
