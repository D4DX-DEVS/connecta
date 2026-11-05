// One-off: Mongo dump (JSON) -> D1 SQL inserts + list of files to copy to R2.
// Usage: node convert.mjs <dump.json> <out.sql> <keys.json>
import fs from 'node:fs';
import { ENT, col, toDb } from '../src/lib.js';

const [dumpFile, sqlFile, keysFile] = process.argv.slice(2);
const dump = JSON.parse(fs.readFileSync(dumpFile, 'utf8'));
const MAP = { users: 'users', booths: 'booths', questions: 'questions', guestusers: 'guest_users', quizattempts: 'quiz_attempts', quizconfigs: 'quiz_configs', feedbacks: 'feedback', galleries: 'galleries', notifications: 'notifications', programs: 'programs' };
const NOT_NULL = { users: ['name'], booths: ['name', 'title', 'description'], questions: ['booth', 'question', 'options'], quiz_attempts: ['userType', 'totalTime'], feedback: ['user'] };

const keys = new Set();
const SPACES = /^https?:\/\/(?:[a-z0-9-]+\.)*digitaloceanspaces\.com\/(?:[a-z0-9-]+\/(?=connecta\/))?/i;
const rewrite = (v) => {
  if (typeof v === 'string') {
    const m = SPACES.exec(v);
    if (m) { const key = decodeURIComponent(v.slice(m[0].length)); keys.add(key); return '/files/' + v.slice(m[0].length); }
    return v;
  }
  if (Array.isArray(v)) return v.map(rewrite);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, rewrite(x)]));
  return v;
};

const lit = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'");
const lines = [];
const problems = [];
const counts = {};

for (const [coll, name] of Object.entries(MAP)) {
  const ent = ENT[name];
  const docs = dump[coll] || [];
  counts[name] = docs.length;
  for (const raw of docs) {
    const doc = rewrite(raw);
    const data = { ...ent.defaults() };
    for (const k of Object.keys(ent.fields)) if (doc[k] !== undefined) data[k] = doc[k];
    if (name === 'users') { if (!data.email) data.email = null; if (!data.mobile) data.mobile = null; }
    for (const k of NOT_NULL[name] || []) if (data[k] == null || data[k] === '') problems.push(`${name} ${doc._id}: missing ${k}`);
    const ts = (v) => (v ? new Date(v).toISOString() : new Date().toISOString());
    const fields = Object.keys(ent.fields);
    const cols = ['id', ...fields.map(col), 'created_at', 'updated_at'];
    const vals = [doc._id, ...fields.map((k) => toDb(ent.fields[k], data[k])), ts(doc.createdAt), ts(doc.updatedAt)];
    lines.push(`INSERT INTO ${ent.table} (${cols.join(',')}) VALUES (${vals.map(lit).join(',')});`);
  }
}
fs.writeFileSync(sqlFile, lines.join('\n') + '\n');
fs.writeFileSync(keysFile, JSON.stringify([...keys], null, 1));
console.log(counts);
console.log('statements:', lines.length, '| files referenced:', keys.size, '| problems:', problems.length);
problems.slice(0, 10).forEach((p) => console.log(' ', p));
