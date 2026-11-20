// בדיקת CTA: כניסה באיחור לדקה 31 מציגה את השאלון, ובדקה 40 הוא כבר לא מוצג.
process.env.SIGNING_SECRET = "test-secret";
process.env.PORT = "3115";
const assert = require("assert");
const server = require("../dev-server");
const { sign } = require("../lib/token");
const cfg = require("../webinar.config");
(async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch();
  for (const [minute, expected] of [[31, true], [40, false], [49, true], [55, false]]) {
    const start = Date.now() - minute * 60000;
    const t = sign({ id: "t" + minute, n: "דנה כהן", e: "dana@example.com", p: "0501234567", s: start });
    const page = await browser.newPage();
    await page.route(/youtube|vimeo|facebook/, (r) => r.abort());
    await page.goto(`http://localhost:3115/room.html?t=${encodeURIComponent(t)}`);
    await page.waitForFunction(() => !document.getElementById("cover"), null, { timeout: 40000 });
    await page.waitForTimeout(800);
    const visible = await page.evaluate(() => getComputedStyle(document.getElementById("cta")).display !== "none");
    assert.strictEqual(visible, expected, `minute ${minute}: cta visible=${visible}`);
    if (expected) {
      assert.match(await page.textContent("#ctaTitle"), /לשאלון התאמה/);
      assert.match(await page.textContent("#ctaBtn"), /לשאלון התאמה/);
    }
    await page.close();
  }
  await browser.close();
  console.log("cta ok", cfg.questionnaire.ctas.map((c) => c.at));
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
