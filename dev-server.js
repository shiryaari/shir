// שרת פיתוח מקומי: מגיש את public/ ואת api/ בדיוק כמו Vercel.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

try { // טעינת .env פשוטה
  for (const line of fs.readFileSync(path.join(__dirname, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch {}

const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/api/")) {
    const file = path.join(__dirname, "api", path.basename(url.pathname) + ".js");
    if (!fs.existsSync(file)) return (res.statusCode = 404), res.end("not found");
    let raw = "";
    for await (const chunk of req) raw += chunk;
    req.body = raw;
    req.query = Object.fromEntries(url.searchParams);
    res.status = (c) => ((res.statusCode = c), res);
    res.json = (o) => (res.setHeader("content-type", "application/json"), res.end(JSON.stringify(o)));
    try { return await require(file)(req, res); }
    catch (e) { console.error(e); return res.status(500).json({ error: "server_error" }); }
  }
  let p = url.pathname === "/" ? "/index.html" : url.pathname;
  const file = path.join(__dirname, "public", path.normalize(p));
  if (!file.startsWith(path.join(__dirname, "public")) || !fs.existsSync(file)) return (res.statusCode = 404), res.end("not found");
  res.setHeader("content-type", types[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`http://localhost:${port}`));
module.exports = server;
