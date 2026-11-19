// בדיקת צ'אט משידור קודם: הודעה מהקובץ מופיעה, והכותרת מסמנת אותה. הקובץ מוחזר לריק בסוף.
process.env.SIGNING_SECRET = "test-secret";
process.env.PORT = "3116";
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const file = path.join(__dirname, "..", "public", "chat-replay.json");
const original = fs.readFileSync(file, "utf8");
fs.writeFileSync(file, JSON.stringify([{ at: 1, name: "רונה", text: "היי שיר" }]));
const server = require("../dev-server");
const { sign } = require("../lib/token");
(async () => {
  try {
    const { chromium } = require("playwright");
    const browser = await chromium.launch();
    const t = sign({ id: "rp1", n: "דנה כהן", e: "dana@example.com", p: "0501234567", s: Date.now() - 10000 });
    const page = await browser.newPage();
    await page.route(/youtube|vimeo|facebook/, (r) => r.abort());
    await page.goto(`http://localhost:3116/room.html?t=${encodeURIComponent(t)}`);
    await page.waitForSelector("#enter:not([hidden])", { timeout: 5000 });
    await page.click("#enter");
    await page.waitForFunction(() => [...document.querySelectorAll(".msg")].some((m) => m.textContent.includes("היי שיר")), null, { timeout: 5000 });
    assert.match(await page.textContent("#replayLabel"), /משידור קודם/);
    await browser.close();
    console.log("replay ok");
  } finally {
    fs.writeFileSync(file, original);
    server.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
