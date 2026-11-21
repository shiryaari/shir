// דשבורד: מחשב נכון נרשמות, נוכחות, צפייה, שאלון וצ'אט מהאחסון, ומוגן בסיסמה.
process.env.SIGNING_SECRET = "test-secret";
process.env.HOST_SECRET = "test-host";
process.env.PORT = "3120";
const assert = require("assert");
const server = require("../dev-server");
const store = require("../lib/store");
const { sign } = require("../lib/token");
const cfg = require("../webinar.config");
const base = "http://localhost:3120";
(async () => {
  try {
    const start = Date.now() - 3600000;
    const P = [["r1", "דנה כהן", "dana@example.com", "0501111111"], ["r2", "מיכל לוי", "michal@example.com", "0502222222"], ["r3", "רונית", "ronit@example.com", "0503333333"]];
    for (const [rid, name, email, phone] of P) await store.zadd(`reg:${start}`, Date.now(), JSON.stringify({ rid, name, email, phone, registered_at: new Date().toISOString(), utm_source: "fb" }));
    await store.zadd("sessions:all", start, String(start));
    const tok = (i) => sign({ id: P[i][0], n: P[i][1], e: P[i][2], p: P[i][3], s: start });
    const ev = (t, event, data) => fetch(`${base}/api/event`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ t, event, data }) });
    await ev(tok(0), "joined", { joined_at_second: 5 });
    await ev(tok(0), "chat_message", { text: "היי", at_second: 30 });
    await ev(tok(0), "questionnaire_submitted", {});
    await ev(tok(0), "left", { watched_seconds: cfg.durationSeconds / 2, at_second: 2000 });
    await ev(tok(1), "joined", { joined_at_second: 60 });
    await ev(tok(1), "questionnaire_opened", {});
    await ev(tok(2), "replay", { watch_time_seconds: 600, completion_pct: 15 });

    assert.strictEqual((await fetch(`${base}/api/dashboard?secret=bad`)).status, 401);
    const d = await (await fetch(`${base}/api/dashboard?secret=test-host`)).json();
    assert.strictEqual(d.totals.registered, 3);
    assert.strictEqual(d.totals.attended, 2);
    assert.strictEqual(d.totals.attendance_pct, 67);
    assert.strictEqual(d.totals.submitted, 1);
    assert.strictEqual(d.totals.opened, 2);
    assert.strictEqual(d.totals.chat_messages, 1);
    assert.strictEqual(d.totals.replay_viewers, 1);
    const dana = d.sessions[0].people.find((p) => p.email === "dana@example.com");
    assert.strictEqual(dana.pct, 50);
    assert(dana.attended && dana.submitted && dana.chat === 1);
    assert.strictEqual(d.sessions[0].people.find((p) => p.email === "ronit@example.com").attended, false);

    const { chromium } = require("playwright");
    const b = await chromium.launch(), page = await b.newPage();
    await page.goto(`${base}/dashboard.html`);
    await page.fill("#secret", "test-host"); await page.press("#secret", "Enter");
    await page.waitForSelector("#dash:not([hidden])", { timeout: 5000 });
    await page.waitForFunction(() => document.getElementById("kpis").textContent.includes("67%"), null, { timeout: 5000 });
    assert((await page.textContent("#sessions")).includes("דנה כהן"));
    await b.close();
    console.log("dashboard ok");
  } finally { server.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
