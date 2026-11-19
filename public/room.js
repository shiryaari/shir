(async () => {
  const $ = (id) => document.getElementById(id);
  const token = new URLSearchParams(location.search).get("t");
  const bad = () => { $("bad").hidden = false; };
  if (!token) return bad();

  let S;
  try {
    const r = await fetch("/api/session?t=" + encodeURIComponent(token));
    if (!r.ok) return bad();
    S = await r.json();
  } catch { return bad(); }

  const C = S.config;
  const skew = S.serverNow - Date.now();              // הפרש שעון מול השרת
  const now = () => Date.now() + skew;
  const elapsed = () => (now() - S.start) / 1000;     // שניות מתחילת הסשן (שלילי = לפני)
  const fill = (s) => s.replaceAll("{name}", S.firstName);

  $("room").hidden = false;
  document.title = C.title;
  $("title").textContent = C.title;
  $("badge").textContent = C.badge;

  const send = (event, data = {}, beacon = false) => {
    const payload = JSON.stringify({ t: token, event, data });
    if (beacon && navigator.sendBeacon) return navigator.sendBeacon("/api/event", new Blob([payload], { type: "text/plain" }));
    return fetch("/api/event", { method: "POST", headers: { "content-type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
  };

  // ---------- צ'אט ----------
  const msgs = $("msgs");
  const addMsg = (who, text, cls = "") => {
    const d = document.createElement("div");
    d.className = "msg " + cls;
    const b = document.createElement("b"); b.textContent = who;
    const p = document.createElement("span"); p.textContent = text;
    d.append(b, p); msgs.append(d); msgs.scrollTop = msgs.scrollHeight;
  };
  const shown = new Set();
  const tickChat = () => {
    const e = elapsed();
    C.chat.forEach((m, i) => {
      if (m.at <= e && !shown.has(i)) {
        shown.add(i);
        addMsg(m.from === "host" ? C.hostName : m.from, fill(m.text), m.from === "host" ? "host" : "");
      }
    });
  };

  $("form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const text = $("text").value.trim(); if (!text) return;
    $("text").value = "";
    addMsg(S.firstName, text, "me");
    const rule = C.replies.rules.find((r) => r.match.some((k) => text.includes(k)));
    const [lo, hi] = C.replies.delaySeconds;
    setTimeout(() => addMsg(C.hostName, fill((rule ? rule.text : C.replies.fallback)), "host"), (lo + Math.random() * (hi - lo)) * 1000);
  });

  // ---------- שאלון ----------
  const qUrl = () => C.questionnaire.url
    .replaceAll("{token}", encodeURIComponent(token))
    .replaceAll("{name}", encodeURIComponent(S.name))
    .replaceAll("{email}", encodeURIComponent(S.email));
  let qShown = false, qDone = false;
  const showCta = () => {
    qShown = true;
    $("cta").style.display = "block";
    $("ctaText").textContent = fill(C.questionnaire.hostMessage);
    $("ctaBtn").textContent = C.questionnaire.buttonText;
    addMsg(C.hostName, fill(C.questionnaire.hostMessage), "host");
  };
  $("ctaBtn").addEventListener("click", () => {
    send("questionnaire_opened");
    if (C.questionnaire.embed) { $("qframe").src = qUrl(); $("modal").classList.add("open"); }
    else window.open(qUrl(), "_blank", "noopener");
  });
  $("close").addEventListener("click", () => $("modal").classList.remove("open"));
  addEventListener("message", (ev) => {
    if (ev.data && ev.data.type === "questionnaire:done") {
      qDone = true;
      setTimeout(() => $("modal").classList.remove("open"), 1500);
      $("cta").style.display = "none";
    }
  });

  // ---------- נגן ----------
  let player = null, entered = false, watched = 0, lastTick = 0;
  const reported = new Set();
  const stage = $("stage");

  async function startVideo() {
    const target = Math.max(0, elapsed());
    if (!C.vimeoId) {                       // מצב בדיקה בלי וידאו
      const m = document.createElement("div");
      m.className = "mock"; m.textContent = "מצב בדיקה: כאן יופיע הסרטון מ-Vimeo";
      stage.append(m); return;
    }
    const [id, h] = C.vimeoId.split("/");
    const ifr = document.createElement("iframe");
    ifr.allow = "autoplay; fullscreen; picture-in-picture";
    ifr.src = `https://player.vimeo.com/video/${id}?${h ? "h=" + h + "&" : ""}controls=0&autoplay=1&playsinline=1&title=0&byline=0&portrait=0&dnt=1`;
    stage.append(ifr);
    player = new Vimeo.Player(ifr);
    await player.ready();
    await player.setCurrentTime(target);
    player.play().catch(() => {});
    player.on("pause", () => { if (elapsed() < C.durationSeconds) player.play().catch(() => {}); }); // כמו שידור חי
    player.on("timeupdate", (d) => { if (Math.abs(d.seconds - elapsed()) > 4) player.setCurrentTime(Math.max(0, elapsed())); });
  }

  $("enter").addEventListener("click", async () => {
    if (entered) return;
    entered = true;
    $("cover").remove();
    lastTick = Date.now();
    send("joined", { joined_at_second: Math.round(Math.max(0, elapsed())) });
    await startVideo();
  });

  // ---------- שעון ראשי ----------
  const fmt = (s) => {
    s = Math.max(0, Math.ceil(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (h ? h + ":" : "") + String(m).padStart(2, "0") + ":" + String(x).padStart(2, "0");
  };
  let ended = false;
  setInterval(() => {
    const e = elapsed();
    if (!entered && !ended) {
      if (e < 0) { $("count").textContent = fmt(-e); }
      else if (e < C.durationSeconds) {
        $("coverText").textContent = "הוובינר כבר התחיל";
        $("count").hidden = true; $("enter").hidden = false;
      }
    }
    if (e >= 0) tickChat();
    if (e >= C.questionnaire.atSeconds && !qShown && !qDone && e < C.durationSeconds + 600) showCta();

    if (entered && !document.hidden) {
      watched += (Date.now() - lastTick) / 1000;
      const pct = (Math.min(e, C.durationSeconds) / C.durationSeconds) * 100;
      for (const m of C.progressMilestones) {
        if (pct >= m && !reported.has(m)) { reported.add(m); send("progress", { percent: m, watched_seconds: Math.round(watched) }); }
      }
    }
    if (entered) lastTick = Date.now();

    if (e >= C.durationSeconds && !ended) {
      ended = true;
      if (!entered) { $("coverText").textContent = "הסשן הזה הסתיים"; $("count").hidden = true; $("enter").hidden = true; }
      else stage.innerHTML = `<div class="cover"><div style="font-size:1.6rem">${C.endedMessage}</div></div>`;
      addMsg(C.hostName, C.endedMessage, "host");
      if (entered && !qDone && C.questionnaire.endReminder) {
        $("cta").style.display = "block";
        $("ctaText").textContent = fill(C.questionnaire.endReminder);
        $("ctaBtn").textContent = C.questionnaire.buttonText;
        addMsg(C.hostName, fill(C.questionnaire.endReminder), "host");
      }
    }
  }, 500);

  addEventListener("pagehide", () => { if (entered) send("left", { watched_seconds: Math.round(watched), at_second: Math.round(Math.max(0, elapsed())) }, true); });
})();
