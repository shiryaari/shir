#!/usr/bin/env node
// ממיר קובץ CSV של צ'אט משידור קודם לקובץ שהחדר קורא (public/chat-replay.json).
// שימוש:  node scripts/import-chat.js chat.csv
// עמודות (עם או בלי כותרת): זמן, שם, הודעה.   זמן: mm:ss או h:mm:ss (מתחילת הסרטון)
// השם נחתך לשם פרטי בלבד (פרטיות).
const fs = require("fs");
const path = require("path");

const src = process.argv[2];
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
  const p = String(t).trim().split(":").map(Number);
  if (p.some((x) => !Number.isFinite(x))) return null;
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : null;
};

const out = [];
for (const r of parseCsv(fs.readFileSync(src, "utf8").replace(/^﻿/, ""))) {
  const at = toSeconds(r[0]);
  if (at === null) continue; // שורת כותרת
  const name = String(r[1] || "").trim().split(/\s+/)[0];
  const text = String(r.slice(2).join(",") || "").trim();
  if (name && text) out.push({ at, name, text });
}
out.sort((a, b) => a.at - b.at);
const dest = path.join(__dirname, "..", "public", "chat-replay.json");
fs.writeFileSync(dest, JSON.stringify(out, null, 1));
console.log(`${out.length} messages -> ${dest}`);
