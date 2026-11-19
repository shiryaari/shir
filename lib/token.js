const crypto = require("crypto");

function secret() {
  const s = process.env.SIGNING_SECRET;
  if (!s) throw new Error("SIGNING_SECRET is not set");
  return s;
}
const hmac = (body) => crypto.createHmac("sha256", secret()).update(body).digest("base64url");

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(body)}`;
}

function verify(token) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const a = Buffer.from(sig || "");
  const b = Buffer.from(hmac(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
}

module.exports = { sign, verify };
