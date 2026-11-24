// Local preview: `npm run dev`, then open http://localhost:3000
// Without GOOGLE_MAPS_API_KEY it serves sample (demo) data.
import http from "node:http";
import { readFile } from "node:fs/promises";
import handler from "./api/search.js";

const PORT = process.env.PORT || 3000;

http
  .createServer(async (req, res) => {
    if (req.url.startsWith("/api/search")) return handler(req, res);
    if (req.url === "/" || req.url.startsWith("/?")) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end(await readFile(new URL("./public/index.html", import.meta.url)));
    }
    res.statusCode = 404;
    res.end("Not found");
  })
  .listen(PORT, () => console.log(`Place Tracker running at http://localhost:${PORT}`));
