// צ'אט חי: הודעה של צופה אחת מגיעה לצופה אחרת באותו סשן, שיר עונה מהמסך, והתשובה מגיעה לכולן.
process.env.SIGNING_SECRET = "test-secret";
process.env.HOST_SECRET = "test-host";
process.env.PORT = "3117";
const assert = require("assert");
const server = require("../dev-server");
const { sign } = require("../lib/token");
const base = "http://localhost:3117";
(async () => {
  const start = Date.now() - 5000;
  const mk = (id, n) => sign({ id, n, e: id + "@example.com", p: "0501234567", s: start });
  const tA = mk("a1", "דנה כהן"), tB = mk("b1", "מיכל לוי");

  // הגנות
  assert.strictEqual((await fetch(`${base}/api/host-poll?secret=wrong`)).status, 401);
  assert.strictEqual((await fetch(`${base}/api/chat-poll?t=bad`)).status, 401);

  const { chromium } = require("playwright");
  const browser = await chromium.launch();
  const open = async (t) => {
    const p = await browser.newPage();
    await p.route(/youtube|vimeo|facebook/, (r) => r.abort());
    await p.goto(`${base}/room.html?t=${encodeURIComponent(t)}`);
    await p.waitForFunction(() => !document.getElementById("cover"), null, { timeout: 40000 });
    return p;
  };
  const A = await open(tA), B = await open(tB);
  const has = (p, txt) => p.waitForFunction((x) => [...document.querySelectorAll(".msg")].some((m) => m.textContent.includes(x)), txt, { timeout: 9000 });

  await A.fill("#text", "שלום מדנה, האם יש מקום לשאלה?");
  await A.press("#text", "Enter");
  await has(A, "האם יש מקום לשאלה");
  await has(B, "האם יש מקום לשאלה"); // הצופה השנייה רואה
  const fromDana = await B.evaluate(() => [...document.querySelectorAll(".msg")].find((m) => m.textContent.includes("האם יש מקום")).querySelector("b").textContent);
  assert.strictEqual(fromDana, "דנה");

  // שיר רואה במסך הניהול ועונה
  const hp = await (await fetch(`${base}/api/host-poll?secret=test-host&after=0`)).json();
  assert(hp.session && hp.messages.some((m) => m.text.includes("האם יש מקום")), "host sees the question");
  const rr = await fetch(`${base}/api/host-reply`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ secret: "test-host", session: hp.session, text: "בטח דנה, שואלות עכשיו!" }) });
  assert.strictEqual(rr.status, 200);
  await has(A, "שואלות עכשיו");
  await has(B, "שואלות עכשיו");
  const hostFrom = await B.evaluate(() => [...document.querySelectorAll(".msg.host")].find((m) => m.textContent.includes("שואלות עכשיו")).querySelector("b").textContent);
  assert.strictEqual(hostFrom, "שיר");

  // דף הניהול נטען
  const H = await browser.newPage();
  await H.goto(`${base}/host.html`);
  await H.fill("#secret", "test-host");
  await H.press("#secret", "Enter");
  await H.waitForSelector("#main:not([hidden])", { timeout: 5000 });
  await H.waitForFunction(() => document.getElementById("list").textContent.includes("האם יש מקום"), null, { timeout: 8000 });
  await browser.close();
  console.log("live ok");
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
