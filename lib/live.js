const crypto = require("crypto");
const store = require("./store");

const chatKey = (session) => `chat:${session}`;

async function addMessage(session, { role, from, text, rid }) {
  const score = store.nextScore();
  const id = crypto.randomBytes(5).toString("hex");
  const member = JSON.stringify({ id, role, from, text, rid: rid || "" });
  await store.zadd(chatKey(session), score, member);
  await store.zadd("chat:sessions", Number(session), String(session));
  return { id, at: score };
}

async function messagesAfter(session, afterScore, viewerRid) {
  const rows = await store.after(chatKey(session), Number(afterScore) || 0);
  return rows.map(({ member, score }) => {
    const m = JSON.parse(member);
    return { id: m.id, at: score, role: m.role, from: m.from, text: m.text, mine: viewerRid ? m.rid === viewerRid : false };
  });
}

const clean = (t) => String(t || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 300);

function hostOk(secret) {
  const s = process.env.HOST_SECRET;
  if (!s || typeof secret !== "string") return false;
  const a = Buffer.from(secret), b = Buffer.from(s);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { addMessage, messagesAfter, clean, hostOk };
