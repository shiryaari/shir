// דוח סוף סשן והקלטה: אותו מבנה ש-Talexa שלחה. בודקים ששדות הדוח נכונים ושאין דיווח כפול.
process.env.SIGNING_SECRET = "test-secret";
process.env.HOST_SECRET = "test-host";
process.env.PORT = "3118";
const http = require("http");
const assert = require("assert");
const got = { ended: [], events: [] };
const cap = http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { got[req.url.slice(1)].push(JSON.parse(b)); res.end("ok"); });
}).listen(0, async () => {
  const port = cap.address().port;
  process.env.MAKE_ENDED_WEBHOOK_URL = `http://localhost:${port}/ended`;
  process.env.MAKE_EVENTS_WEBHOOK_URL = `http://localhost:${port}/events`;
  const server = require("../dev-server");
  const store = require("../lib/store");
  const { sign } = require("../lib/token");
  const cfg = require("../webinar.config");
  const base = "http://localhost:3118";
  try {
    const start = Date.now() - (cfg.durationSeconds + 600) * 1000;
    const people = [["r1", "דנה כהן", "dana@example.com", "0501111111"], ["r2", "מיכל לוי", "michal@example.com", "0502222222"]];
    for (const [rid, name, email, phone] of people)
      await store.zadd(`reg:${start}`, Date.now(), JSON.stringify({ rid, name, email, phone, registered_at: new Date().toISOString() }));
    await store.zadd("sessions:all", start, String(start));
    const tok = (i) => sign({ id: people[i][0], n: people[i][1], e: people[i][2], p: people[i][3], s: start });
    const ev = (t, event, data) => fetch(`${base}/api/event`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ t, event, data }) });
    // דנה נכחה, כתבה, פתחה ומילאה שאלון. מיכל לא נכנסה.
    await ev(tok(0), "joined", { joined_at_second: 3 });
    await ev(tok(0), "chat_message", { text: "שלום לכולן", at_second: 60 });
    await ev(tok(0), "questionnaire_opened", {});
    await ev(tok(0), "questionnaire_submitted", {});
    await ev(tok(0), "progress", { percent: 50, watched_seconds: 2000 });
    await ev(tok(0), "left", { watched_seconds: cfg.durationSeconds / 2, at_second: 2100 });

    assert.strictEqual((await fetch(`${base}/api/session-end?secret=bad`)).status, 401);
    const r1 = await (await fetch(`${base}/api/session-end?secret=test-host`)).json();
    assert.strictEqual(r1.sent.length, 1, "one session reported");
    const rep = got.ended[0];
    assert.strictEqual(rep.webinar_id, cfg.webinarId);
    assert.strictEqual(rep.registered.length, 2);
    assert.strictEqual(rep.showed_up.length, 1);
    const s = rep.showed_up[0];
    assert.strictEqual(s.email, "dana@example.com");
    assert.strictEqual(s.completion_pct, 50);
    assert.strictEqual(s.peak_offset, 2100);
    assert.strictEqual(s.chat_history[0].message, "שלום לכולן");
    assert(s.cta_data && s.cta_data.email);
    assert.strictEqual(rep.converted.length, 1);
    assert.deepStrictEqual([rep.summary.total_registered, rep.summary.total_showed_up, rep.summary.total_converted, rep.summary.conversion_rate_pct], [2, 1, 1, 100]);
    assert.strictEqual(rep.registered.find((x) => x.email === "michal@example.com").showed_up, false);

    const r2 = await (await fetch(`${base}/api/session-end?secret=test-host`)).json();
    assert.strictEqual(r2.sent.length, 0, "no double reporting");

    // צפייה בהקלטה
    const rr = await ev(tok(1), "replay", { watch_time_seconds: 1500, completion_pct: 40 });
    assert.strictEqual(rr.status, 200);
    const rv = got.ended[1];
    assert.strictEqual(rv.replay_viewers.length, 1);
    assert.deepStrictEqual([rv.replay_viewers[0].email, rv.replay_viewers[0].completion_pct, rv.replay_viewers[0].watch_time_seconds], ["michal@example.com", 40, 1500]);
    assert(rv.replay_viewers[0].last_watched_at);
    console.log("report ok");
  } finally { server.close(); cap.close(); }
});
