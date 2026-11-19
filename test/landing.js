// בדיקת דף הנחיתה: טעינה, ספירה לאחור, הרשמה והפניה לדף התודה (מיירטים את הניווט החיצוני).
process.env.SIGNING_SECRET = "test-secret";
process.env.PORT = "3112";
const assert = require("assert");
const server = require("../dev-server");
const base = "http://localhost:3112";
(async () => {
  const { chromium, devices } = require("playwright");
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "he-IL" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let thanks = null;
  await page.route(/shir-yaari\.co\.il\/webinar-intro/, (r) => { thanks = r.request().url(); r.fulfill({ status: 200, body: "ok" }); });
  await page.route(/facebook\.(com|net)/, (r) => r.abort());
  await page.goto(base + "/");
  await page.waitForFunction(() => /\d\d/.test(document.querySelector("[data-d]").textContent) && document.querySelector("[data-when]").textContent.length > 3, null, { timeout: 8000 });
  await page.screenshot({ path: "/tmp/landing-mobile.png" });
  // ולידציה
  await page.click("button[type=submit]");
  assert((await page.textContent("[data-msg]")).length > 0, "validation message");
  await page.fill("#f-name", "דנה כהן");
  await page.fill("#f-email", "dana@example.com");
  await page.fill("#f-phone", "050-1234567");
  await page.check("input[name=consent]");
  await page.click("button[type=submit]");
  await page.waitForURL(/webinar-intro/, { timeout: 8000 });
  assert(/email=dana%40example.com/.test(thanks) && /lead_id=lp[0-9a-f]{16}/.test(thanks), "thanks url: " + thanks);
  assert.deepStrictEqual(errors, [], "page errors");
  await browser.close();
  console.log("landing ok:", thanks);
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
