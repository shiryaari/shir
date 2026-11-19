#!/usr/bin/env node
// ממיר קובץ CSV של צ'אט משידור קודם לקובץ שהחדר קורא (public/chat-replay.json).
// שימוש:  node scripts/import-chat.js chat.csv
// עמודות: זמן, שם, הודעה, או senderName, message, timestamp (כמו בתבנית של טלקסה). זמן: שניות, mm:ss או h:mm:ss
// השם נשמר כמו בקובץ. עם הדגל --first-names נשמר שם פרטי בלבד.
const fs = require("fs");
const path = require("path");

const src = process.argv.slice(2).find((a) => !a.startsWith("--"));
const firstNamesOnly = process.argv.includes("--first-names");
if (!src) { console.error("usage: node scripts/import-chat.js chat.csv"); process.exit(1); }

function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === "," || c === "\t") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}
const toSeconds = (t) => {
  const str = String(t).trim();
  if (/^\d+(\.\d+)?$/.test(str)) return Math.round(Number(str)); // שניות (כמו בתבנית של טלקסה)
  const p = str.split(":").map(Number);
  if (p.some((x) => !Number.isFinite(x))) return null;
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : null;
};

const rows = parseCsv(fs.readFileSync(src, "utf8").replace(/^\uFEFF/, ""));
// זיהוי עמודות לפי כותרת: timestamp/זמן, senderName/שם, message/הודעה. בלי כותרת: זמן, שם, הודעה.
let col = { at: 0, name: 1, text: 2 };
const head = (rows[0] || []).map((x) => String(x).trim().toLowerCase());
const find = (...names) => head.findIndex((h) => names.includes(h));
if (find("timestamp", "זמן") >= 0 && find("sendername", "שם", "name") >= 0 && find("message", "הודעה", "text") >= 0) {
  col = { at: find("timestamp", "זמן"), name: find("sendername", "שם", "name"), text: find("message", "הודעה", "text") };
}

const out = [];
for (const r of rows) {
  const at = toSeconds(r[col.at]);
  if (at === null) continue; // שורת כותרת
  const full = String(r[col.name] || "").trim();
  const name = firstNamesOnly ? full.split(/\s+/)[0] : full;
  const text = String(r[col.text] || "").trim();
  if (name && text) out.push({ at, name, text });
}
out.sort((a, b) => a.at - b.at);
const dest = path.join(__dirname, "..", "public", "chat-replay.json");
fs.writeFileSync(dest, JSON.stringify(out, null, 1));
console.log(`${out.length} messages -> ${dest}`);
