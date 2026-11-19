// אחסון הודעות הצ'אט החי. בפרודקשן: Upstash Redis (חיבור חינמי דרך Vercel Storage).
// בלי חיבור: זיכרון (מתאים רק לפיתוח מקומי). ב-Vercel בלי חיבור מחזירים שגיאה, כדי שלא יהיה שבור בשקט.
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const mem = new Map();

const available = () => Boolean(URL_ && TOKEN) || !process.env.VERCEL;

async function cmd(args) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

async function zadd(key, score, member, ttl = 172800) {
  if (URL_ && TOKEN) { await cmd(["ZADD", key, String(score), member]); await cmd(["EXPIRE", key, String(ttl)]); return; }
  if (!mem.has(key)) mem.set(key, []);
  mem.get(key).push({ score, member });
}

// כל מה שהציון שלו גדול מ-after, מהישן לחדש
async function after(key, afterScore = 0, limit = 300) {
  if (URL_ && TOKEN) {
    const flat = (await cmd(["ZRANGEBYSCORE", key, `(${afterScore}`, "+inf", "WITHSCORES", "LIMIT", "0", String(limit)])) || [];
    const out = [];
    for (let i = 0; i < flat.length; i += 2) out.push({ member: flat[i], score: Number(flat[i + 1]) });
    return out;
  }
  return (mem.get(key) || []).filter((x) => x.score > afterScore).sort((a, b) => a.score - b.score).slice(0, limit);
}

async function latest(key) {
  if (URL_ && TOKEN) { const r = await cmd(["ZREVRANGE", key, "0", "0"]); return r && r[0] ? r[0] : null; }
  const arr = (mem.get(key) || []).sort((a, b) => a.score - b.score);
  return arr.length ? arr[arr.length - 1].member : null;
}

let seq = 0;
const nextScore = () => Date.now() + (++seq % 1000) / 1000;

module.exports = { available, zadd, after, latest, nextScore };
