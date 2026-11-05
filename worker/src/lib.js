// Shared helpers: entity <-> D1 row mapping (Mongo-shaped JSON), errors, ids, time zones.

export class ApiError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export const newId = () => {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
};
export const isId = (s) => /^[0-9a-f]{24}$/i.test(s || '');
export const nowIso = () => new Date().toISOString();

const snake = (s) => s.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
const COL = { order: 'sort_order', user: 'user_id', guestUser: 'guest_user_id', booth: 'booth_id', rank: 'rank_pos' };
export const col = (k) => COL[k] || snake(k);

// types: s string, n number, b bool, g nullable bool, j json, d date (ISO text)
export const ENT = {
  users: {
    table: 'users',
    fields: { name: 's', email: 's', mobile: 's', place: 's', gender: 'g', role: 's', avatar: 's', bookmarkedBooths: 'j', visitedBooths: 'j', isActive: 'b', lastLogin: 'd' },
    defaults: () => ({ role: 'user', gender: null, bookmarkedBooths: [], visitedBooths: [], isActive: true }),
    required: ['name']
  },
  booths: {
    table: 'booths',
    fields: { name: 's', title: 's', description: 's', logo: 's', audioFile: 's', videoFile: 's', galleryImages: 'j', resources: 'j', isPublished: 'b', order: 'n', visitCount: 'n', bookmarkCount: 'n', metadata: 'j' },
    defaults: () => ({ galleryImages: [], resources: [], isPublished: true, order: 0, visitCount: 0, bookmarkCount: 0, metadata: { tags: [], contactInfo: {} } }),
    required: ['name', 'title', 'description']
  },
  questions: {
    table: 'questions',
    fields: { booth: 's', question: 's', options: 'j', explanation: 's', difficulty: 's', points: 'n', isActive: 'b' },
    defaults: () => ({ explanation: '', difficulty: 'medium', points: 10, isActive: true }),
    required: ['booth', 'question']
  },
  guest_users: {
    table: 'guest_users',
    fields: { name: 's', age: 'n', mobile: 's', place: 's', totalAttempts: 'n', lastAttemptDate: 'd' },
    defaults: () => ({ totalAttempts: 0, lastAttemptDate: null }),
    required: ['name', 'age', 'mobile', 'place']
  },
  quiz_attempts: {
    table: 'quiz_attempts',
    fields: { user: 's', guestUser: 's', userType: 's', mobile: 's', answers: 'j', totalQuestions: 'n', correctAnswers: 'n', score: 'n', totalTime: 'n', percentage: 'n', attemptDate: 'd', rank: 'n' },
    defaults: () => ({ answers: [], totalQuestions: 10, correctAnswers: 0, score: 0, percentage: 0, rank: null }),
    required: ['userType', 'totalTime']
  },
  quiz_configs: {
    table: 'quiz_configs',
    fields: { startDate: 'd', endDate: 'd', dailyStartTime: 's', dailyEndTime: 's', topCount: 'n', isActive: 'b', timezone: 's', description: 's' },
    defaults: () => ({ dailyStartTime: '08:00', dailyEndTime: '21:00', topCount: 10, isActive: true, timezone: 'Asia/Kolkata', description: '' }),
    required: ['startDate', 'endDate']
  },
  feedback: {
    table: 'feedback',
    fields: { user: 's', ratings: 'j', textFeedback: 's', isAnonymous: 'b', status: 's', adminNotes: 's' },
    defaults: () => ({ isAnonymous: false, status: 'pending', adminNotes: '' }),
    required: ['user']
  },
  galleries: {
    table: 'galleries',
    fields: { images: 'j', isActive: 'b' },
    defaults: () => ({ images: [], isActive: true }),
    required: []
  },
  notifications: {
    table: 'notifications',
    fields: { title: 's', message: 's', type: 's', priority: 's', isPublished: 'b', publishDate: 'd', expiryDate: 'd', targetAudience: 's', readBy: 'j', metadata: 'j' },
    defaults: () => ({ type: 'general', priority: 'normal', isPublished: true, publishDate: nowIso(), expiryDate: null, targetAudience: 'all', readBy: [] }),
    required: ['title', 'message']
  },
  programs: {
    table: 'programs',
    fields: { title: 's', description: 's', date: 'd', startTime: 's', endTime: 's', speakers: 'j', status: 's' },
    defaults: () => ({ speakers: [], status: 'published' }),
    required: ['title', 'description', 'date', 'startTime', 'endTime']
  }
};

const ENUMS = {
  users: { role: ['user', 'admin'] },
  questions: { difficulty: ['easy', 'medium', 'hard'] },
  feedback: { status: ['pending', 'reviewed', 'archived'] },
  notifications: { type: ['general', 'event', 'important', 'exhibition'], priority: ['normal', 'high', 'urgent'], targetAudience: ['all', 'users', 'admins'] },
  programs: { status: ['draft', 'published'] },
  quiz_attempts: { userType: ['registered', 'guest'] }
};

export const toDb = (t, v) => {
  if (v === undefined) v = null;
  switch (t) {
    case 'j': return JSON.stringify(v);
    case 'b': return v ? 1 : 0;
    case 'g': return v == null ? null : v ? 1 : 0;
    case 'd': { if (!v) return null; const d = new Date(v); if (isNaN(d)) throw new ApiError(400, 'Invalid date'); return d.toISOString(); }
    case 'n': return v == null || v === '' ? null : Number(v);
    default: return v == null ? null : String(v);
  }
};

const fromDb = (t, v) => {
  if (t === 'j') return v == null ? null : JSON.parse(v);
  if (t === 'b') return !!v;
  if (t === 'g') return v == null ? null : !!v;
  return v ?? null;
};

export const fromRow = (ent, row) => {
  if (!row) return null;
  const doc = { _id: row.id };
  for (const [k, t] of Object.entries(ent.fields)) doc[k] = fromDb(t, row[col(k)]);
  doc.createdAt = row.created_at;
  doc.updatedAt = row.updated_at;
  doc.__v = 0;
  return doc;
};

const validate = (name, ent, data, partial) => {
  const msgs = [];
  if (!partial) for (const k of ent.required) if (data[k] == null || data[k] === '') msgs.push(`Path \`${k}\` is required.`);
  for (const [k, allowed] of Object.entries(ENUMS[name] || {})) {
    if (data[k] != null && !allowed.includes(data[k])) msgs.push(`\`${data[k]}\` is not a valid enum value for path \`${k}\`.`);
  }
  if (msgs.length) throw new ApiError(400, msgs.join(', '));
};

const uniqueCheck = async (db, name, data, exceptId) => {
  if (name !== 'users') return;
  for (const k of ['email', 'mobile']) {
    if (!data[k]) continue;
    const r = await db.prepare(`SELECT id FROM users WHERE ${k} = ?${exceptId ? ' AND id != ?' : ''}`).bind(...(exceptId ? [data[k], exceptId] : [data[k]])).first();
    if (r) throw new ApiError(400, 'Duplicate field value entered');
  }
};

export const findById = async (db, name, id) => {
  if (!isId(id)) return null;
  const ent = ENT[name];
  return fromRow(ent, await db.prepare(`SELECT * FROM ${ent.table} WHERE id = ?`).bind(id).first());
};

export const insert = async (db, name, input) => {
  const ent = ENT[name];
  const data = { ...ent.defaults() };
  for (const k of Object.keys(ent.fields)) if (input[k] !== undefined) data[k] = input[k];
  validate(name, ent, data, false);
  await uniqueCheck(db, name, data);
  const id = newId();
  const ts = nowIso();
  const keys = Object.keys(ent.fields);
  const cols = ['id', ...keys.map(col), 'created_at', 'updated_at'];
  const vals = [id, ...keys.map((k) => toDb(ent.fields[k], data[k])), ts, ts];
  await db.prepare(`INSERT INTO ${ent.table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).bind(...vals).run();
  return findById(db, name, id);
};

export const update = async (db, name, id, patch) => {
  const ent = ENT[name];
  if (!isId(id)) return null;
  const keys = Object.keys(ent.fields).filter((k) => patch[k] !== undefined);
  validate(name, ent, patch, true);
  await uniqueCheck(db, name, patch, id);
  const sets = [...keys.map((k) => `${col(k)} = ?`), 'updated_at = ?'];
  const vals = [...keys.map((k) => toDb(ent.fields[k], patch[k])), nowIso(), id];
  const res = await db.prepare(`UPDATE ${ent.table} SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  if (!res.meta.changes) return null;
  return findById(db, name, id);
};

export const remove = async (db, name, id) => {
  if (!isId(id)) return false;
  const res = await db.prepare(`DELETE FROM ${ENT[name].table} WHERE id = ?`).bind(id).run();
  return res.meta.changes > 0;
};

export const query = async (db, name, where = '', params = [], tail = '') => {
  const ent = ENT[name];
  const { results } = await db.prepare(`SELECT * FROM ${ent.table} ${where ? 'WHERE ' + where : ''} ${tail}`).bind(...params).all();
  return results.map((r) => fromRow(ent, r));
};

export const count = async (db, name, where = '', params = []) => {
  const r = await db.prepare(`SELECT COUNT(*) AS n FROM ${ENT[name].table} ${where ? 'WHERE ' + where : ''}`).bind(...params).first();
  return r.n;
};

// Fetch docs for many ids in one query, return Map(id -> doc)
export const byIds = async (db, name, ids) => {
  const uniq = [...new Set(ids.filter(isId))];
  const map = new Map();
  for (let i = 0; i < uniq.length; i += 90) {
    const chunk = uniq.slice(i, i + 90);
    const docs = await query(db, name, `id IN (${chunk.map(() => '?').join(',')})`, chunk);
    docs.forEach((d) => map.set(d._id, d));
  }
  return map;
};

export const pick = (doc, keys) => {
  if (!doc) return null;
  const o = { _id: doc._id };
  keys.forEach((k) => (o[k] = doc[k]));
  return o;
};

// --- URL helpers: stored values may be relative "/files/..." -> absolute on output
export const absUrl = (origin, v) => (typeof v === 'string' && v.startsWith('/files/') ? origin + v : v);
const IMG_FIELDS = ['logo', 'audioFile', 'videoFile', 'avatar'];
export const absDoc = (origin, doc) => {
  if (!doc) return doc;
  const o = { ...doc };
  for (const f of IMG_FIELDS) if (f in o) o[f] = absUrl(origin, o[f]);
  for (const f of ['galleryImages', 'images']) if (Array.isArray(o[f])) o[f] = o[f].map((u) => absUrl(origin, u));
  if (Array.isArray(o.speakers)) o.speakers = o.speakers.map((s) => ({ ...s, photo: absUrl(origin, s.photo) }));
  return o;
};

// --- time zone helpers (replace moment-timezone)
const tzParts = (date, tz) => {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
};
export const zonedToUtc = (y, m, d, h, mi, s, tz) => {
  const guess = Date.UTC(y, m - 1, d, h, mi, s);
  const p = tzParts(new Date(guess), tz);
  const off = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - guess;
  return new Date(guess - off);
};
export const localDay = (date, tz) => {
  const p = tzParts(date, tz);
  return { ...p, start: zonedToUtc(p.y, p.m, p.d, 0, 0, 0, tz), end: zonedToUtc(p.y, p.m, p.d, 23, 59, 59, tz) };
};
export const fmtDate = (date, tz) =>
  new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'long', day: 'numeric', year: 'numeric' }).format(date);

export const parseExpire = (s = '7d') => {
  const m = /^(\d+)\s*([smhd])?$/.exec(String(s));
  if (!m) return 7 * 86400;
  return +m[1] * { s: 1, m: 60, h: 3600, d: 86400 }[m[2] || 's'];
};
