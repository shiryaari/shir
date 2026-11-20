// דף הקלטה אישי: ניגון חופשי (אפשר לדלג), ומעקב צפייה ששולח "replay" ל-Make (צפו בהקלטה)
(async () => {
  const $ = (id) => document.getElementById(id);
  const token = new URLSearchParams(location.search).get("t");
  const bad = () => { $("bad").hidden = false; };
  if (!token) return bad();
  let S;
  try { const r = await fetch("/api/session?t=" + encodeURIComponent(token)); if (!r.ok) return bad(); S = await r.json(); } catch { return bad(); }
  const C = S.config;
  $("room").hidden = false; $("title").textContent = C.title; document.title = C.title;

  let watched = 0, maxPos = 0, sentWatched = 0, last = 0, playing = false;
  const send = (beacon) => {
    if (watched - sentWatched < 5) return;
    sentWatched = watched;
    const payload = JSON.stringify({ t: token, event: "replay", data: { watch_time_seconds: Math.round(watched), completion_pct: Math.round(Math.min(100, (maxPos / C.durationSeconds) * 100)) } });
    if (beacon && navigator.sendBeacon) navigator.sendBeacon("/api/event", new Blob([payload], { type: "text/plain" }));
    else fetch("/api/event", { method: "POST", headers: { "content-type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
  };
  setInterval(() => { if (playing && !document.hidden) watched += (Date.now() - last) / 1000; last = Date.now(); }, 1000);
  setInterval(() => send(false), 30000);
  addEventListener("pagehide", () => send(true));

  const stage = $("stage");
  if (C.vimeoId) {
    const [id, h] = C.vimeoId.split("/");
    const ifr = document.createElement("iframe");
    ifr.allow = "autoplay; fullscreen; picture-in-picture";
    ifr.src = `https://player.vimeo.com/video/${id}?${h ? "h=" + h + "&" : ""}playsinline=1&title=0&byline=0&portrait=0&dnt=1`;
    stage.append(ifr);
    const p = new Vimeo.Player(ifr);
    p.on("play", () => { playing = true; last = Date.now(); });
    p.on("pause", () => { playing = false; send(false); });
    p.on("timeupdate", (d) => { maxPos = Math.max(maxPos, d.seconds); });
  } else if (C.youtubeId) {
    await new Promise((res) => { if (window.YT && YT.Player) return res(); window.onYouTubeIframeAPIReady = res; const sc = document.createElement("script"); sc.src = "https://www.youtube.com/iframe_api"; document.head.append(sc); });
    const holder = document.createElement("div"); holder.id = "ytp"; stage.append(holder);
    const yt = new YT.Player("ytp", { videoId: C.youtubeId, width: "100%", height: "100%", playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
      events: { onStateChange: (e) => { playing = e.data === YT.PlayerState.PLAYING; last = Date.now(); if (!playing) send(false); } } });
    setInterval(() => { try { if (playing) maxPos = Math.max(maxPos, yt.getCurrentTime()); } catch {} }, 1000);
  } else {
    const m = document.createElement("div"); m.className = "mock"; m.textContent = "מצב בדיקה: כאן תופיע ההקלטה";
    stage.append(m); playing = true; last = Date.now(); setInterval(() => { maxPos += 1; }, 1000);
  }
})();
