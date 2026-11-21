// בדיקת צ'אט מקובץ מול מיקום הניגון ב-Vimeo, בלי תלות ברשת.
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
    await page.route("https://player.vimeo.com/api/player.js", (route) => route.fulfill({
      contentType: "application/javascript",
      body: `window.Vimeo = { Player: class {
        async ready() {}
        async setCurrentTime() {}
        async play() {}
        on(event, callback) { if (event === "timeupdate") window.setVideoPosition = callback; }
      } };`,
    }));
    await page.route("https://player.vimeo.com/video/**", (route) => route.abort());
    await page.goto(`http://localhost:3116/room.html?t=${encodeURIComponent(t)}`);
    await page.waitForFunction(() => !document.getElementById("cover"), null, { timeout: 40000 });
    await page.waitForFunction(() => typeof window.setVideoPosition === "function");
    assert.strictEqual(await page.getByText("היי שיר", { exact: true }).count(), 0);
    await page.evaluate(() => window.setVideoPosition({ seconds: 10 }));
    await page.getByText("היי שיר", { exact: true }).waitFor({ timeout: 5000 });
    assert.strictEqual((await page.textContent("#replayLabel")).trim(), "", "no label by default");
    await browser.close();
    console.log("replay ok");
  } finally {
    fs.writeFileSync(file, original);
    server.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
