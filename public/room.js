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
    const av = document.createElement("i"); av.className = "av"; av.textContent = (who || "?").trim().charAt(0);
    const bd = document.createElement("div"); bd.className = "bd";
    const b = document.createElement("b"); b.textContent = who;
    const p = document.createElement("span"); p.textContent = text;
    bd.append(b, p); d.append(av, bd); msgs.append(d); msgs.scrollTop = msgs.scrollHeight;
  };
  // צ'אט משידור קודם: נטען מקובץ, ומסומן בכותרת
  if (C.chatReplay && C.chatReplay.file) {
    try {
      const rr = await fetch(C.chatReplay.file, { cache: "no-store" });
      const list = rr.ok ? await rr.json() : [];
      if (Array.isArray(list) && list.length) {
        C.chat = C.chat.concat(list.map((m) => ({ at: Number(m.at) || 0, from: String(m.name || ""), text: String(m.text || "") })));
        if (C.chatReplay.label) $("replayLabel").textContent = "· " + C.chatReplay.label;
      }
    } catch {}
  }
  const shown = new Set();
  const tickChat = () => {
    const e = elapsed();
    C.chat.forEach((m, i) => {
      if (m.at <= e && !shown.has(i)) {
        shown.add(i);
        const isHost = m.from === "host" || m.from === C.hostName;
        addMsg(isHost ? C.hostName : m.from, fill(m.text), isHost ? "host" : "");
      }
    });
  };

  // ----- צ'אט חי: הודעות של כל הצופות בסשן ותשובות של שיר בזמן אמת -----
  const liveOn = C.liveChat && C.liveChat.enabled;
  const liveSeen = new Set();
  let liveAfter = 0;
  async function livePoll() {
    try {
      const r = await fetch(`/api/chat-poll?t=${encodeURIComponent(token)}&after=${liveAfter}`, { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      for (const m of d.messages) {
        liveAfter = Math.max(liveAfter, m.at);
        if (liveSeen.has(m.id)) continue;
        liveSeen.add(m.id);
        if (m.role === "host") addMsg(m.from, m.text, "host");
        else if (m.mine) addMsg(S.firstName, m.text, "me");
        else addMsg(m.from, m.text, "");
      }
    } catch {}
  }
  if (liveOn) { livePoll(); setInterval(livePoll, (C.liveChat.pollSeconds || 3) * 1000); }

  $("form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const text = $("text").value.trim(); if (!text) return;
    $("text").value = "";
    let sentLive = false;
    if (liveOn) {
      try {
        const r = await fetch("/api/chat-send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ t: token, text }) });
        if (r.ok) {
          const d = await r.json();
          if (!liveSeen.has(d.id)) { liveSeen.add(d.id); addMsg(S.firstName, text, "me"); }
          sentLive = true;
        }
      } catch {}
    }
    if (!sentLive) addMsg(S.firstName, text, "me");
    send("chat_message", { text: text.slice(0, 500), at_second: Math.round(Math.max(0, elapsed())) });
    const rule = C.replies.rules.find((r) => r.match.some((k) => text.includes(k)));
    const [lo, hi] = C.replies.delaySeconds;
    setTimeout(() => addMsg(C.hostName, fill((rule ? rule.text : C.replies.fallback)), "host"), (lo + Math.random() * (hi - lo)) * 1000);
  });

  // ---------- שאלון ----------
  const qUrl = () => C.questionnaire.url
    .replaceAll("{token}", encodeURIComponent(token))
    .replaceAll("{name}", encodeURIComponent(S.name))
    .replaceAll("{email}", encodeURIComponent(S.email))
    .replaceAll("{phone}", encodeURIComponent(S.phone || ""))
    .replaceAll("{id}", encodeURIComponent(S.id));
  let qDone = false, activeCta = -1;
  const syncCta = () => {
    const e = elapsed();
    const i = qDone ? -1 : C.questionnaire.ctas.findIndex((c) => e >= c.at && e < c.at + c.durationSeconds);
    if (i === activeCta) return;
    activeCta = i;
    if (i < 0) { $("cta").style.display = "none"; return; }
    const c = C.questionnaire.ctas[i];
    $("ctaTitle").textContent = fill(c.title);
    $("ctaDesc").textContent = fill(c.description || "");
    $("ctaBtn").textContent = c.buttonText;
    $("cta").style.display = "block";
  };
  $("ctaBtn").addEventListener("click", () => {
    send("questionnaire_opened");
    if (C.questionnaire.embed) { frameLoads = 0; $("qframe").src = qUrl(); $("modal").classList.add("open"); }
    else window.open(qUrl(), "_blank", "noopener");
  });
  $("close").addEventListener("click", () => $("modal").classList.remove("open"));
  addEventListener("message", (ev) => {
    if (ev.data && ev.data.type === "questionnaire:done") markDone(false);
  });

  // ---------- נגן ----------
  let player = null, ytPlayer = null, entered = false, watched = 0, lastTick = 0;
  const reported = new Set();
  const stage = $("stage");

  async function startYouTube(target) {
    await new Promise((res) => {
      if (window.YT && YT.Player) return res();
      window.onYouTubeIframeAPIReady = res;
      const sc = document.createElement("script"); sc.src = "https://www.youtube.com/iframe_api"; document.head.append(sc);
    });
    const holder = document.createElement("div"); holder.id = "ytp"; stage.append(holder);
    const p = ytPlayer = new YT.Player("ytp", {
      videoId: C.youtubeId, width: "100%", height: "100%",
      playerVars: { controls: 0, disablekb: 1, rel: 0, modestbranding: 1, playsinline: 1, autoplay: 1, mute: 1, start: Math.floor(target) },
      events: {
        onReady: (e) => { e.target.mute(); e.target.seekTo(target, true); e.target.playVideo(); },
        onStateChange: (e) => { if (e.data === YT.PlayerState.PAUSED && elapsed() < C.durationSeconds) e.target.playVideo(); },
      },
    });
    setInterval(() => { // תיקון סטייה מול השעון, כמו שידור חי
      try { const e = elapsed(); if (e >= 0 && e < C.durationSeconds && Math.abs(p.getCurrentTime() - e) > 4) p.seekTo(e, true); } catch {}
    }, 2000);
  }

  async function startVideo() {
    const target = Math.max(0, elapsed());
    const shield = document.createElement("div"); // חוסם לחיצות על הסרטון (השהיה/דילוג)
    shield.style.cssText = "position:absolute;inset:0;z-index:2";
    if (!C.vimeoId && C.youtubeId) { await startYouTube(target); stage.append(shield); return; }
    if (!C.vimeoId) {                       // מצב בדיקה בלי וידאו
      const m = document.createElement("div");
      m.className = "mock"; m.textContent = "מצב בדיקה: כאן יופיע הסרטון מ-Vimeo";
      stage.append(m); return;
    }
    const [id, h] = C.vimeoId.split("/");
    const ifr = document.createElement("iframe");
    ifr.allow = "autoplay; fullscreen; picture-in-picture";
    ifr.src = `https://player.vimeo.com/video/${id}?${h ? "h=" + h + "&" : ""}controls=0&autoplay=1&muted=1&playsinline=1&title=0&byline=0&portrait=0&dnt=1`;
    stage.append(ifr); stage.append(shield);
    player = new Vimeo.Player(ifr);
    await player.ready();
    await player.setCurrentTime(target);
    player.play().catch(() => {});
    player.on("pause", () => { if (elapsed() < C.durationSeconds) player.play().catch(() => {}); }); // כמו שידור חי
    player.on("timeupdate", (d) => { if (Math.abs(d.seconds - elapsed()) > 4) player.setCurrentTime(Math.max(0, elapsed())); });
  }

  function addUnmuteOverlay() {
    if (!C.vimeoId && !C.youtubeId) return; // מצב בדיקה בלי וידאו
    const o = document.createElement("div");
    o.id = "unmute";
    o.style.cssText = "position:absolute;inset:0;z-index:3;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35);cursor:pointer";
    const b = document.createElement("button");
    b.className = "unmute-btn";
    b.textContent = "▶ הקישי להפעלת הוובינר, עם קול";
    o.append(b);
    o.addEventListener("click", () => {
      const t = Math.max(0, elapsed());
      try { if (ytPlayer) { ytPlayer.unMute(); ytPlayer.setVolume(100); ytPlayer.seekTo(t, true); ytPlayer.playVideo(); } } catch {}
      try { if (player) { player.setMuted(false); player.setVolume(1); player.setCurrentTime(t); player.play(); } } catch {}
      o.remove();
    });
    stage.append(o);
  }

  // כניסה אוטומטית: הסשן כבר רץ, אז הצופה רואה מיד וובינר שמתנהל (הסרטון מתחיל בלי קול, ועליו כפתור להפעלת קול)
  async function enterRoom() {
    if (entered) return;
    entered = true;
    $("cover").remove();
    lastTick = Date.now();
    send("joined", { joined_at_second: Math.round(Math.max(0, elapsed())) });
    await startVideo();
    addUnmuteOverlay();
  }

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
      else if (e < C.durationSeconds) { enterRoom(); }
    }
    if (e >= 0) tickChat();
    syncCta();

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
    }
  }, 500);

  addEventListener("pagehide", () => { if (entered) send("left", { watched_seconds: Math.round(watched), at_second: Math.round(Math.max(0, elapsed())) }, true); });
})();
