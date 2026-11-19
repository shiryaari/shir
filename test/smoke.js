// בדיקת עשן מקצה לקצה: API + חדר בדפדפן אמיתי (מצב בדיקה בלי Vimeo).
process.env.SIGNING_SECRET = "test-secret";
process.env.PORT = process.env.PORT || "3111";
const assert = require("assert");
const server = require("../dev-server");
const base = `http://localhost:${process.env.PORT}`;
const post = (p, b) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });

(async () => {
  // API
  const slots = await (await fetch(base + "/api/slots")).json();
  assert(slots.slots.length > 0, "slots");
  let r = await post("/api/register", { name: "דנה כהן", email: "bad" , slot: "now"});
  assert.strictEqual(r.status, 400);
  r = await post("/api/register", { name: "דנה כהן", email: "dana@example.com", phone: "0501234567", slot: 12345 });
  assert.strictEqual(r.status, 400, "bad slot rejected");
  r = await post("/api/register", { name: "דנה כהן", email: "dana@example.com", phone: "0501234567", slot: slots.slots[0].ms });
  assert.strictEqual(r.status, 200, "slot register");
  r = await post("/api/register", { name: "דנה כהן", email: "dana@example.com", phone: "0501234567", slot: "now" });
  const reg = await r.json();
  assert(reg.token && reg.roomUrl, "token");
  assert.strictEqual((await fetch(base + "/api/session?t=" + reg.token + "x")).status, 401, "tampered token");
  assert.strictEqual((await post("/api/event", { t: reg.token, event: "hack" })).status, 400);
  console.log("API ok");

  // דפדפן
  const { chromium } = require("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(reg.roomUrl.replace(/^https?:\/\/[^/]+/, base));
  await page.waitForFunction(() => /\d\d:\d\d/.test(document.getElementById("count").textContent), null, { timeout: 5000 });
  await page.waitForSelector("#enter:not([hidden])", { timeout: 40000 });
  await page.click("#enter");
  await page.waitForFunction(() => document.querySelectorAll(".msg").length >= 2, null, { timeout: 30000 });
  const first = await page.textContent(".msg.host");
  assert(first.includes("דנה"), "personal name in chat: " + first);
  await page.fill("#text", "כמה עולה?");
  await page.press("#text", "Enter");
  await page.waitForFunction(() => [...document.querySelectorAll(".msg.host")].some((m) => m.textContent.includes("הוובינר") || m.textContent.includes("בסוף")), null, { timeout: 15000 });
  await page.screenshot({ path: "/tmp/room.png" });
  assert.deepStrictEqual(errors, [], "page errors");
  await browser.close();
  console.log("room ok");
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
