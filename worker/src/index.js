import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sign, verify } from 'hono/jwt';
import {
  ApiError, ENT, newId, isId, nowIso, findById, insert, update, remove, query, count, byIds, pick,
  absDoc, localDay, zonedToUtc, fmtDate, parseExpire
} from './lib.js';

const app = new Hono();

const origin = (c) => (c.env.PUBLIC_URL || new URL(c.req.url).origin).replace(/\/+$/, '');
const out = (c, v) => (Array.isArray(v) ? v.map((d) => absDoc(origin(c), d)) : absDoc(origin(c), v));
const ok = (c, body, status = 200) => c.json({ success: true, ...body }, status);
const fail = (status, message, extra) => { throw new ApiError(status, message, extra); };
const body = async (c) => { try { return await c.req.json(); } catch { return {}; } };

app.use('/api/*', async (c, next) => {
  const allowed = (c.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  return cors({ origin: (o) => (allowed.includes(o) ? o : null), credentials: true })(c, next);
});

app.onError((err, c) => {
  if (err instanceof ApiError) return c.json({ success: false, message: err.message, ...(err.extra || {}) }, err.status);
  console.error(err);
  return c.json({ success: false, message: err.message || 'Server Error' }, 500);
});

// ---------- auth ----------
const sendUnauthorized = () => fail(401, 'Not authorized to access this route');

const protect = async (c, next) => {
  const h = c.req.header('Authorization') || '';
  const token = h.startsWith('Bearer') ? h.split(' ')[1] : null;
  if (!token) return sendUnauthorized();
  let payload;
  try { payload = await verify(token, c.env.JWT_SECRET, 'HS256'); } catch { return sendUnauthorized(); }
  const user = await findById(c.env.DB, 'users', payload.id);
  if (!user) return fail(404, 'User not found');
  if (!user.isActive) return fail(403, 'User account is deactivated');
  c.set('user', user);
  await next();
};
const optionalAuth = async (c, next) => {
  if (c.req.header('Authorization')?.split(' ')[1]) return protect(c, next);
  c.set('user', null);
  await next();
};
const authorize = (...roles) => async (c, next) => {
  const u = c.get('user');
  if (!roles.includes(u.role)) fail(403, `User role '${u.role}' is not authorized to access this route`);
  await next();
};
const admin = [protect, authorize('admin')];

const makeToken = (c, id) => {
  const iat = Math.floor(Date.now() / 1000);
  return sign({ id, iat, exp: iat + parseExpire(c.env.JWT_EXPIRE) }, c.env.JWT_SECRET, 'HS256');
};

app.get('/api/health', (c) => c.json({ success: true, message: 'Connecta API is running', timestamp: nowIso() }));

app.post('/api/auth/register', async (c) => {
  const { name, email, mobile, place, gender } = await body(c);
  if (!email && !mobile) fail(400, 'Please provide either email or mobile number');
  const db = c.env.DB;
  const existing = await db.prepare('SELECT id FROM users WHERE (? IS NOT NULL AND email = ?) OR (? IS NOT NULL AND mobile = ?)')
    .bind(email ? email.toLowerCase() : null, email ? email.toLowerCase() : null, mobile || null, mobile || null).first();
  if (existing) fail(400, 'User already exists with this email or phone number');
  const user = await insert(db, 'users', { name, place, gender, email: email ? email.toLowerCase() : null, mobile: mobile || null });
  return ok(c, { data: { user: out(c, user), token: await makeToken(c, user._id) } }, 201);
});

app.post('/api/auth/login', async (c) => {
  const { email, mobile, identifier } = await body(c);
  const id = (identifier || email || mobile || '').trim();
  if (!id) fail(400, 'Please provide email or phone number');
  const isEmail = id.includes('@') || !!email;
  const [user] = await query(c.env.DB, 'users', `${isEmail ? 'email' : 'mobile'} = ?`, [isEmail ? id.toLowerCase() : id]);
  if (!user) fail(401, 'No account found with this email or phone number');
  if (!user.isActive) fail(403, 'Account is deactivated');
  const updated = await update(c.env.DB, 'users', user._id, { lastLogin: nowIso() });
  return ok(c, { data: { user: out(c, updated), token: await makeToken(c, user._id) } });
});

app.get('/api/auth/me', protect, async (c) => {
  const user = c.get('user');
  const booths = await byIds(c.env.DB, 'booths', [...user.bookmarkedBooths, ...user.visitedBooths.map((v) => v.booth)]);
  const slim = (id) => (booths.has(id) ? out(c, pick(booths.get(id), ['name', 'title', 'logo'])) : null);
  return ok(c, {
    data: out(c, {
      ...user,
      bookmarkedBooths: user.bookmarkedBooths.map(slim).filter(Boolean),
      visitedBooths: user.visitedBooths.map((v) => ({ ...v, booth: slim(v.booth) }))
    })
  });
});

app.put('/api/auth/profile', protect, async (c) => {
  const { name, email, mobile, place, gender } = await body(c);
  const patch = { name, place, gender };
  if (email !== undefined) patch.email = email ? email.toLowerCase() : null;
  if (mobile !== undefined) patch.mobile = mobile || null;
  return ok(c, { data: out(c, await update(c.env.DB, 'users', c.get('user')._id, patch)) });
});

// ---------- uploads (R2) ----------
const TYPES = {
  image: /^(jpeg|jpg|png|gif|webp)$/, audio: /^(mp3|wav|ogg|m4a)$/, video: /^(mp4|webm|ogg|mov)$/, doc: /^pdf$/
};
const ALLOWED_ERR = 'Invalid file type. Only images, audio, video, and PDF files are allowed.';

const saveFile = async (c, file, field) => {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const mt = file.type || '';
  let folder;
  if (mt.startsWith('image/') && TYPES.image.test(ext)) folder = 'images';
  else if (mt.startsWith('audio/') && TYPES.audio.test(ext)) folder = 'audio';
  else if (mt.startsWith('video/') && TYPES.video.test(ext)) folder = 'video';
  else if (mt === 'application/pdf' && TYPES.doc.test(ext)) folder = 'documents';
  else fail(400, ALLOWED_ERR);
  const base = (c.env.UPLOAD_FOLDER || 'connecta').replace(/^\/+|\/+$/g, '');
  const key = `${base}/${folder}/${field}-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
  await c.env.UPLOADS.put(key, file.stream(), { httpMetadata: { contentType: mt } });
  return `${origin(c)}/files/${key}`;
};

const parseFiles = async (c) => {
  const form = await c.req.parseBody({ all: true });
  const files = {};
  for (const [k, v] of Object.entries(form)) {
    const arr = (Array.isArray(v) ? v : [v]).filter((f) => typeof f !== 'string');
    if (arr.length) files[k] = arr;
  }
  return files;
};

app.get('/files/*', async (c) => {
  const key = decodeURIComponent(new URL(c.req.url).pathname.replace(/^\/files\//, ''));
  const obj = await c.env.UPLOADS.get(key);
  if (!obj) return c.json({ success: false, message: 'File not found' }, 404);
  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set('etag', obj.httpEtag);
  h.set('cache-control', 'public, max-age=31536000, immutable');
  h.set('access-control-allow-origin', '*');
  return new Response(obj.body, { headers: h });
});

// ---------- booths ----------
app.post('/api/booths/upload', ...admin, async (c) => {
  const files = await parseFiles(c);
  if (!Object.keys(files).length) fail(400, 'No files were uploaded');
  const data = {};
  if (files.logo) data.logo = await saveFile(c, files.logo[0], 'logo');
  if (files.audio) data.audioFile = await saveFile(c, files.audio[0], 'audio');
  if (files.video) data.videoFile = await saveFile(c, files.video[0], 'video');
  if (files.galleryImages) data.galleryImages = await Promise.all(files.galleryImages.slice(0, 25).map((f) => saveFile(c, f, 'galleryImages')));
  return ok(c, { data, message: 'Files uploaded successfully to Cloudflare R2' });
});

app.get('/api/booths', async (c) => {
  const { search, category, sort } = c.req.query();
  const where = ['is_published = 1'];
  const params = [];
  if (search) { where.push('(name LIKE ? OR title LIKE ? OR description LIKE ?)'); params.push(...Array(3).fill(`%${search}%`)); }
  if (category) { where.push("json_extract(metadata, '$.category') = ?"); params.push(category); }
  const order = sort === 'popular' ? 'visit_count DESC' : sort === 'recent' ? 'created_at DESC' : 'sort_order ASC';
  const booths = await query(c.env.DB, 'booths', where.join(' AND '), params, `ORDER BY ${order}`);
  return ok(c, { count: booths.length, data: out(c, booths) });
});

app.get('/api/booths/:id', async (c) => {
  const id = c.req.param('id');
  if (!isId(id)) fail(400, 'Invalid booth ID format');
  await c.env.DB.prepare('UPDATE booths SET visit_count = visit_count + 1 WHERE id = ?').bind(id).run();
  const booth = await findById(c.env.DB, 'booths', id);
  if (!booth) fail(404, 'Booth not found');
  return ok(c, { data: out(c, booth) });
});

app.post('/api/booths', ...admin, async (c) => ok(c, { data: out(c, await insert(c.env.DB, 'booths', await body(c))) }, 201));

app.put('/api/booths/:id', ...admin, async (c) => {
  const booth = await update(c.env.DB, 'booths', c.req.param('id'), await body(c));
  if (!booth) fail(404, 'Booth not found');
  return ok(c, { data: out(c, booth) });
});

app.delete('/api/booths/:id', ...admin, async (c) => {
  if (!(await remove(c.env.DB, 'booths', c.req.param('id')))) fail(404, 'Booth not found');
  return ok(c, { message: 'Booth deleted successfully' });
});

app.post('/api/booths/:id/bookmark', protect, async (c) => {
  const boothId = c.req.param('id');
  const user = c.get('user');
  const booth = await findById(c.env.DB, 'booths', boothId);
  if (!booth) fail(404, 'Booth not found');
  const has = user.bookmarkedBooths.includes(boothId);
  const list = has ? user.bookmarkedBooths.filter((b) => b !== boothId) : [...user.bookmarkedBooths, boothId];
  await update(c.env.DB, 'users', user._id, { bookmarkedBooths: list });
  await update(c.env.DB, 'booths', boothId, { bookmarkCount: Math.max(0, booth.bookmarkCount + (has ? -1 : 1)) });
  return ok(c, { bookmarked: !has, data: list });
});

app.post('/api/booths/:id/visit', protect, async (c) => {
  const boothId = c.req.param('id');
  const user = c.get('user');
  if (!(await findById(c.env.DB, 'booths', boothId))) fail(404, 'Booth not found');
  let visited = user.visitedBooths;
  if (!visited.some((v) => v.booth === boothId)) {
    visited = [...visited, { booth: boothId, visitedAt: nowIso(), _id: newId() }];
    await update(c.env.DB, 'users', user._id, { visitedBooths: visited });
  }
  return ok(c, { message: 'Booth marked as visited', data: visited });
});

// ---------- quiz config + availability ----------
const HHMM = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
const validateConfig = (cfg) => {
  if (new Date(cfg.endDate) <= new Date(cfg.startDate)) fail(400, 'End date must be after start date');
  if (!HHMM.test(cfg.dailyStartTime) || !HHMM.test(cfg.dailyEndTime)) fail(400, 'Please provide valid time in HH:MM format');
  const [sh, sm] = cfg.dailyStartTime.split(':').map(Number);
  const [eh, em] = cfg.dailyEndTime.split(':').map(Number);
  if (eh < sh || (eh === sh && em <= sm)) fail(400, 'Daily end time must be after daily start time');
  if (cfg.topCount < 1) fail(400, 'Top count must be at least 1');
};

const checkQuizAvailability = async (c, next) => {
  const [config] = await query(c.env.DB, 'quiz_configs', 'is_active = 1', [], 'LIMIT 1');
  if (!config) fail(400, 'No active quiz available at the moment');
  const tz = config.timezone;
  const now = new Date();
  const startDay = localDay(new Date(config.startDate), tz);
  const endDay = localDay(new Date(config.endDate), tz);
  if (now < startDay.start) fail(400, `Quiz starts on ${fmtDate(startDay.start, tz)}`, { startsAt: startDay.start.toISOString() });
  if (now > endDay.end) fail(400, 'Quiz period has ended', { endedAt: endDay.end.toISOString() });
  const today = localDay(now, tz);
  const [sh, sm] = config.dailyStartTime.split(':').map(Number);
  const [eh, em] = config.dailyEndTime.split(':').map(Number);
  const dailyStart = zonedToUtc(today.y, today.m, today.d, sh, sm, 0, tz);
  const dailyEnd = zonedToUtc(today.y, today.m, today.d, eh, em, 59, tz);
  if (now < dailyStart) fail(400, `Quiz is available from ${config.dailyStartTime} to ${config.dailyEndTime} IST`, { availableAt: dailyStart.toISOString() });
  if (now > dailyEnd) fail(400, `Today's quiz time has ended. Come back tomorrow at ${config.dailyStartTime} IST`, { availableAt: new Date(dailyStart.getTime() + 86400000).toISOString() });
  c.set('quizConfig', config);
  await next();
};

const checkDailyAttempt = async (c, next) => {
  const { mobile } = await body(c);
  if (!mobile) return next();
  const config = c.get('quizConfig');
  const today = localDay(new Date(), config.timezone);
  const [existing] = await query(c.env.DB, 'quiz_attempts', 'mobile = ? AND attempt_date >= ? AND attempt_date <= ?',
    [mobile, today.start.toISOString(), today.end.toISOString()], 'LIMIT 1');
  if (existing) {
    const [sh, sm] = config.dailyStartTime.split(':').map(Number);
    fail(400, "You have already completed today's quiz. Please try again tomorrow!", {
      nextAttemptAt: zonedToUtc(today.y, today.m, today.d + 1, sh, sm, 0, config.timezone).toISOString(),
      previousScore: existing.score,
      previousCorrect: existing.correctAnswers
    });
  }
  await next();
};

app.get('/api/quiz-config/active', async (c) => {
  const [config] = await query(c.env.DB, 'quiz_configs', 'is_active = 1', [], 'LIMIT 1');
  if (!config) fail(404, 'No active quiz configuration found');
  return ok(c, { data: config });
});
app.get('/api/quiz-config', ...admin, async (c) => {
  const configs = await query(c.env.DB, 'quiz_configs', '', [], 'ORDER BY created_at DESC');
  return ok(c, { count: configs.length, data: configs });
});
app.post('/api/quiz-config', ...admin, async (c) => {
  const data = await body(c);
  const merged = { ...ENT.quiz_configs.defaults(), ...data };
  if (merged.startDate && merged.endDate) validateConfig(merged);
  if (data.isActive) await c.env.DB.prepare('UPDATE quiz_configs SET is_active = 0').run();
  return ok(c, { data: await insert(c.env.DB, 'quiz_configs', data) }, 201);
});
app.put('/api/quiz-config/:id', ...admin, async (c) => {
  const id = c.req.param('id');
  const data = await body(c);
  const current = await findById(c.env.DB, 'quiz_configs', id);
  if (!current) fail(404, 'Quiz configuration not found');
  validateConfig({ ...current, ...data });
  if (data.isActive) await c.env.DB.prepare('UPDATE quiz_configs SET is_active = 0 WHERE id != ?').bind(id).run();
  return ok(c, { data: await update(c.env.DB, 'quiz_configs', id, data) });
});
app.delete('/api/quiz-config/:id', ...admin, async (c) => {
  if (!(await remove(c.env.DB, 'quiz_configs', c.req.param('id')))) fail(404, 'Quiz configuration not found');
  return ok(c, { message: 'Quiz configuration deleted successfully' });
});

// ---------- quiz ----------
const validateQuestion = (q) => {
  if (!Array.isArray(q.options) || q.options.length !== 4) fail(400, 'Each question must have exactly 4 options');
  if (q.options.filter((o) => o.isCorrect).length !== 1) fail(400, 'Each question must have exactly one correct answer');
};

app.get('/api/quiz/leaderboard', async (c) => {
  const { date } = c.req.query();
  const start = date ? new Date(date) : new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCHours(23, 59, 59, 999);
  const attempts = await query(c.env.DB, 'quiz_attempts', 'attempt_date >= ? AND attempt_date <= ?',
    [start.toISOString(), end.toISOString()], 'ORDER BY score DESC, total_time ASC LIMIT 50');
  const users = await byIds(c.env.DB, 'users', attempts.map((a) => a.user));
  const best = new Map();
  for (const a of attempts) {
    const key = a.userType === 'registered' ? a.user : a.mobile;
    if (key && !best.has(key)) best.set(key, a);
  }
  const data = [...best.values()].map((a, i) => ({
    rank: i + 1,
    user: users.has(a.user) ? out(c, pick(users.get(a.user), ['name', 'email', 'avatar'])) : undefined,
    score: a.score, correctAnswers: a.correctAnswers, totalTime: a.totalTime, percentage: a.percentage, attemptDate: a.attemptDate
  }));
  return ok(c, { count: data.length, data });
});

app.get('/api/quiz/questions', checkQuizAvailability, optionalAuth, async (c) => {
  const booths = await query(c.env.DB, 'booths', 'is_published = 1');
  if (!booths.length) fail(400, 'No published booths available for quiz');
  const boothMap = new Map(booths.map((b) => [b._id, b]));
  const ids = booths.map((b) => b._id);
  const active = await query(c.env.DB, 'questions', `is_active = 1 AND booth_id IN (${ids.map(() => '?').join(',')})`, ids);
  if (!active.length) fail(400, 'No active questions available for quiz');
  const byBooth = new Map();
  active.forEach((q) => byBooth.set(q.booth, [...(byBooth.get(q.booth) || []), q]));
  const questions = [];
  for (const [boothId, list] of byBooth) {
    const q = list[Math.floor(Math.random() * list.length)];
    questions.push({
      _id: q._id, booth: q.booth, boothName: boothMap.get(boothId).name, question: q.question,
      options: q.options.map((o, index) => ({ index, text: o.text })), points: q.points
    });
  }
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }
  const data = questions.slice(0, 10);
  return ok(c, { count: data.length, data });
});

app.post('/api/quiz/submit', checkQuizAvailability, checkDailyAttempt, optionalAuth, async (c) => {
  const { answers, totalTime, guestData } = await body(c);
  const db = c.env.DB;
  const user = c.get('user');
  if (!answers || answers.length !== 10) fail(400, 'Invalid quiz submission. 10 answers required');
  const attempt = { totalQuestions: 10, attemptDate: nowIso(), totalTime };
  if (user) {
    attempt.userType = 'registered';
    attempt.user = user._id;
  } else if (guestData) {
    const { name, age, mobile, place } = guestData;
    if (!name || !age || !mobile || !place) fail(400, 'Guest data incomplete. Name, age, mobile, and place are required');
    if (!/^[0-9]{10}$/.test(mobile)) fail(400, 'Please provide a valid 10-digit mobile number');
    attempt.userType = 'guest';
    attempt.mobile = mobile;
    let [guest] = await query(db, 'guest_users', 'mobile = ?', [mobile], 'LIMIT 1');
    if (!guest) guest = await insert(db, 'guest_users', { name, age, mobile, place });
    guest = await update(db, 'guest_users', guest._id, { totalAttempts: guest.totalAttempts + 1, lastAttemptDate: nowIso() });
    attempt.guestUser = guest._id;
  } else {
    fail(400, 'User authentication or guest data required');
  }

  const questions = await byIds(db, 'questions', answers.map((a) => a.questionId));
  let correct = 0, score = 0;
  const processed = answers.map((a) => {
    const q = questions.get(a.questionId);
    if (!q) fail(404, `Question ${a.questionId} not found`);
    const isCorrect = q.options[a.selectedOption]?.isCorrect || false;
    if (isCorrect) { correct++; score += q.points; }
    return { question: a.questionId, selectedOption: a.selectedOption, isCorrect, timeTaken: a.timeTaken || 0, _id: newId() };
  });
  Object.assign(attempt, { answers: processed, correctAnswers: correct, score, percentage: (correct / 10) * 100 });

  const saved = await insert(db, 'quiz_attempts', attempt);
  const populated = { ...saved, answers: saved.answers.map((a) => ({ ...a, question: questions.get(a.question) })) };
  if (saved.guestUser) {
    const g = await findById(db, 'guest_users', saved.guestUser);
    populated.guestUser = pick(g, ['name', 'age', 'place', 'mobile']);
  }
  return ok(c, { data: populated }, 201);
});

app.get('/api/quiz/history', protect, async (c) => {
  const attempts = await query(c.env.DB, 'quiz_attempts', 'user_id = ?', [c.get('user')._id], 'ORDER BY attempt_date DESC');
  const qs = await byIds(c.env.DB, 'questions', attempts.flatMap((a) => a.answers.map((x) => x.question)));
  const data = attempts.map((a) => ({ ...a, answers: a.answers.map((x) => ({ ...x, question: qs.get(x.question) || x.question })) }));
  return ok(c, { count: data.length, data });
});

const withBooth = async (c, questions) => {
  const booths = await byIds(c.env.DB, 'booths', questions.map((q) => q.booth));
  return questions.map((q) => ({ ...q, booth: booths.has(q.booth) ? pick(booths.get(q.booth), ['name', 'title']) : q.booth }));
};

app.get('/api/quiz/admin/questions', ...admin, async (c) => {
  const { boothId } = c.req.query();
  const qs = await query(c.env.DB, 'questions', boothId ? 'booth_id = ?' : '', boothId ? [boothId] : [], 'ORDER BY created_at DESC');
  return ok(c, { count: qs.length, data: await withBooth(c, qs) });
});

app.get('/api/quiz/attempts', ...admin, async (c) => {
  const { startDate, endDate, userType, mobile, page = 1, limit = 50 } = c.req.query();
  const where = [];
  const params = [];
  if (startDate) { const s = new Date(startDate); s.setUTCHours(0, 0, 0, 0); where.push('attempt_date >= ?'); params.push(s.toISOString()); }
  if (endDate) { const e = new Date(endDate); e.setUTCHours(23, 59, 59, 999); where.push('attempt_date <= ?'); params.push(e.toISOString()); }
  if (userType) { where.push('user_type = ?'); params.push(userType); }
  if (mobile) { where.push('mobile LIKE ?'); params.push(`%${mobile}%`); }
  const w = where.join(' AND ');
  const lim = Math.max(parseInt(limit) || 50, 1);
  const pg = Math.max(parseInt(page) || 1, 1);
  const attempts = await query(c.env.DB, 'quiz_attempts', w, params, `ORDER BY attempt_date DESC, score DESC LIMIT ${lim} OFFSET ${(pg - 1) * lim}`);
  const total = await count(c.env.DB, 'quiz_attempts', w, params);
  const agg = await c.env.DB.prepare(
    `SELECT SUM(user_type = 'guest') AS g, SUM(user_type = 'registered') AS r, AVG(score) AS s, AVG(total_time) AS t FROM quiz_attempts ${w ? 'WHERE ' + w : ''}`
  ).bind(...params).first();
  const users = await byIds(c.env.DB, 'users', attempts.map((a) => a.user));
  const guests = await byIds(c.env.DB, 'guest_users', attempts.map((a) => a.guestUser));
  const data = attempts.map((a) => ({
    ...a,
    user: users.has(a.user) ? pick(users.get(a.user), ['name', 'email', 'mobile']) : a.user,
    guestUser: guests.has(a.guestUser) ? pick(guests.get(a.guestUser), ['name', 'mobile', 'place', 'age']) : a.guestUser
  }));
  return ok(c, {
    count: data.length, total, page: pg, pages: Math.ceil(total / lim),
    stats: { totalAttempts: total, guestAttempts: agg.g || 0, registeredAttempts: agg.r || 0, avgScore: Math.round(agg.s || 0), avgTime: Math.round(agg.t || 0) },
    data
  });
});

app.post('/api/quiz/questions', ...admin, async (c) => {
  const data = await body(c);
  validateQuestion(data);
  return ok(c, { data: await insert(c.env.DB, 'questions', data) }, 201);
});
app.get('/api/quiz/booth/:boothId/questions', ...admin, async (c) => {
  const qs = await query(c.env.DB, 'questions', 'booth_id = ?', [c.req.param('boothId')]);
  return ok(c, { count: qs.length, data: await withBooth(c, qs) });
});
app.put('/api/quiz/questions/:id', ...admin, async (c) => {
  const data = await body(c);
  if (data.options !== undefined) validateQuestion(data);
  const q = await update(c.env.DB, 'questions', c.req.param('id'), data);
  if (!q) fail(404, 'Question not found');
  return ok(c, { data: q });
});
app.delete('/api/quiz/questions/:id', ...admin, async (c) => {
  if (!(await remove(c.env.DB, 'questions', c.req.param('id')))) fail(404, 'Question not found');
  return ok(c, { message: 'Question deleted successfully' });
});

// ---------- feedback ----------
const RATING = ['overallQuality', 'digitalPresence', 'facilities'];
const withUser = async (c, list, keys = ['name', 'email']) => {
  const users = await byIds(c.env.DB, 'users', list.map((f) => f.user));
  return list.map((f) => ({ ...f, user: users.has(f.user) ? pick(users.get(f.user), keys) : f.user }));
};

app.post('/api/feedback', protect, async (c) => {
  const { ratings, textFeedback, isAnonymous } = await body(c);
  for (const k of RATING) {
    const v = ratings?.[k];
    if (v != null && (v < 1 || v > 5)) fail(400, `Path \`ratings.${k}\` must be between 1 and 5.`);
  }
  if (textFeedback && textFeedback.length > 500) fail(400, 'Path `textFeedback` is longer than the maximum allowed length (500).');
  const user = c.get('user');
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const [existing] = await query(c.env.DB, 'feedback', 'user_id = ? AND created_at >= ?', [user._id, today.toISOString()], 'LIMIT 1');
  if (existing) fail(400, 'You have already submitted feedback today');
  const fb = await insert(c.env.DB, 'feedback', {
    user: user._id, ratings: { overallQuality: null, digitalPresence: null, facilities: null, ...ratings }, textFeedback, isAnonymous
  });
  return ok(c, { data: fb }, 201);
});

app.get('/api/feedback/my-feedback', protect, async (c) => {
  const fb = await query(c.env.DB, 'feedback', 'user_id = ?', [c.get('user')._id], 'ORDER BY created_at DESC');
  return ok(c, { count: fb.length, data: fb });
});

app.get('/api/feedback/stats', ...admin, async (c) => {
  const { startDate, endDate } = c.req.query();
  const where = [];
  const params = [];
  if (startDate) { where.push('created_at >= ?'); params.push(new Date(startDate).toISOString()); }
  if (endDate) { where.push('created_at <= ?'); params.push(new Date(endDate).toISOString()); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const r = (k) => `json_extract(ratings, '$.${k}')`;
  const db = c.env.DB;
  const avg = await db.prepare(`SELECT AVG(${r('overallQuality')}) AS avgOverallQuality, AVG(${r('digitalPresence')}) AS avgDigitalPresence, AVG(${r('facilities')}) AS avgFacilities, COUNT(*) AS totalFeedback FROM feedback ${w}`).bind(...params).first();
  const dist = await db.prepare(`SELECT ${r('overallQuality')} AS overallQuality, ${r('digitalPresence')} AS digitalPresence, ${r('facilities')} AS facilities, COUNT(*) AS count FROM feedback ${w} GROUP BY 1, 2, 3`).bind(...params).all();
  const status = await db.prepare(`SELECT status AS _id, COUNT(*) AS count FROM feedback ${w} GROUP BY status`).bind(...params).all();
  return ok(c, {
    data: {
      averages: avg.totalFeedback ? { _id: null, ...avg } : { avgOverallQuality: 0, avgDigitalPresence: 0, avgFacilities: 0, totalFeedback: 0 },
      distribution: dist.results.map(({ count: n, ...id }) => ({ _id: id, count: n })),
      statusCounts: status.results
    }
  });
});

app.get('/api/feedback', ...admin, async (c) => {
  const { status, startDate, endDate, page = 1, limit = 20 } = c.req.query();
  const where = [];
  const params = [];
  if (status) { where.push('status = ?'); params.push(status); }
  if (startDate) { where.push('created_at >= ?'); params.push(new Date(startDate).toISOString()); }
  if (endDate) { where.push('created_at <= ?'); params.push(new Date(endDate).toISOString()); }
  const w = where.join(' AND ');
  const lim = Math.max(parseInt(limit) || 20, 1);
  const pg = Math.max(parseInt(page) || 1, 1);
  const list = await query(c.env.DB, 'feedback', w, params, `ORDER BY created_at DESC LIMIT ${lim} OFFSET ${(pg - 1) * lim}`);
  const total = await count(c.env.DB, 'feedback', w, params);
  return ok(c, { count: total, totalPages: Math.ceil(total / lim), currentPage: pg, data: await withUser(c, list) });
});

app.put('/api/feedback/:id', ...admin, async (c) => {
  const { status, adminNotes } = await body(c);
  const fb = await update(c.env.DB, 'feedback', c.req.param('id'), { status, adminNotes });
  if (!fb) fail(404, 'Feedback not found');
  return ok(c, { data: (await withUser(c, [fb]))[0] });
});

app.delete('/api/feedback/:id', ...admin, async (c) => {
  if (!(await remove(c.env.DB, 'feedback', c.req.param('id')))) fail(404, 'Feedback not found');
  return ok(c, { message: 'Feedback deleted successfully' });
});

// ---------- gallery ----------
app.post('/api/gallery/upload', ...admin, async (c) => {
  const files = await parseFiles(c);
  const imgs = files.images || [];
  if (!imgs.length) fail(400, 'No images were uploaded');
  const urls = await Promise.all(imgs.slice(0, 30).map((f) => saveFile(c, f, 'images')));
  return ok(c, { data: { images: urls }, message: 'Images uploaded successfully to Cloudflare R2' });
});
app.get('/api/gallery/admin/all', ...admin, async (c) => {
  const items = await query(c.env.DB, 'galleries', '', [], 'ORDER BY created_at DESC');
  return ok(c, { count: items.length, data: out(c, items) });
});
app.get('/api/gallery', async (c) => {
  const items = await query(c.env.DB, 'galleries', 'is_active = 1', [], 'ORDER BY created_at DESC');
  return ok(c, { count: items.length, data: out(c, items) });
});
app.get('/api/gallery/:id', async (c) => {
  const id = c.req.param('id');
  if (!isId(id)) fail(400, 'Invalid gallery ID format');
  const item = await findById(c.env.DB, 'galleries', id);
  if (!item) fail(404, 'Gallery item not found');
  return ok(c, { data: out(c, item) });
});
app.post('/api/gallery', ...admin, async (c) => ok(c, { data: out(c, await insert(c.env.DB, 'galleries', await body(c))) }, 201));
app.put('/api/gallery/:id', ...admin, async (c) => {
  const item = await update(c.env.DB, 'galleries', c.req.param('id'), await body(c));
  if (!item) fail(404, 'Gallery item not found');
  return ok(c, { data: out(c, item) });
});
app.delete('/api/gallery/:id', ...admin, async (c) => {
  if (!(await remove(c.env.DB, 'galleries', c.req.param('id')))) fail(404, 'Gallery item not found');
  return ok(c, { message: 'Gallery item deleted successfully' });
});

// ---------- notifications ----------
const LIVE = "is_published = 1 AND publish_date <= ? AND (expiry_date IS NULL OR expiry_date >= ?)";
const live = async (c) => {
  const now = nowIso();
  return query(c.env.DB, 'notifications', LIVE, [now, now], 'ORDER BY priority DESC, publish_date DESC');
};

app.get('/api/notifications', async (c) => {
  const list = await live(c);
  return ok(c, { count: list.length, data: list });
});
app.get('/api/notifications/unread/count', protect, async (c) => {
  const uid = c.get('user')._id;
  const list = (await live(c)).filter((n) => !n.readBy.some((r) => r.user === uid));
  return ok(c, { count: list.length });
});
app.get('/api/notifications/admin/all', ...admin, async (c) => {
  const list = await query(c.env.DB, 'notifications', '', [], 'ORDER BY created_at DESC');
  return ok(c, { count: list.length, data: list });
});
app.get('/api/notifications/:id', async (c) => {
  const n = await findById(c.env.DB, 'notifications', c.req.param('id'));
  if (!n) fail(404, 'Notification not found');
  return ok(c, { data: n });
});
app.post('/api/notifications/:id/read', protect, async (c) => {
  const n = await findById(c.env.DB, 'notifications', c.req.param('id'));
  if (!n) fail(404, 'Notification not found');
  const uid = c.get('user')._id;
  if (!n.readBy.some((r) => r.user === uid)) {
    await update(c.env.DB, 'notifications', n._id, { readBy: [...n.readBy, { user: uid, readAt: nowIso(), _id: newId() }] });
  }
  return ok(c, { message: 'Notification marked as read' });
});
app.post('/api/notifications', ...admin, async (c) => ok(c, { data: await insert(c.env.DB, 'notifications', await body(c)) }, 201));
app.put('/api/notifications/:id', ...admin, async (c) => {
  const n = await update(c.env.DB, 'notifications', c.req.param('id'), await body(c));
  if (!n) fail(404, 'Notification not found');
  return ok(c, { data: n });
});
app.delete('/api/notifications/:id', ...admin, async (c) => {
  if (!(await remove(c.env.DB, 'notifications', c.req.param('id')))) fail(404, 'Notification not found');
  return ok(c, { message: 'Notification deleted successfully' });
});

// ---------- programs ----------
const progOut = (c, list) => out(c, list);
const dayRange = (d) => {
  const s = new Date(d);
  s.setUTCHours(0, 0, 0, 0);
  const e = new Date(s);
  e.setUTCHours(23, 59, 59, 999);
  return [s.toISOString(), e.toISOString()];
};

app.get('/api/programs', async (c) => {
  const { date, upcoming } = c.req.query();
  let where = "status = 'published'";
  const params = [];
  if (date) { const [s, e] = dayRange(date); where += ' AND date >= ? AND date <= ?'; params.push(s, e); }
  else if (upcoming === 'true') { where += ' AND date >= ?'; params.push(dayRange(new Date())[0]); }
  const list = await query(c.env.DB, 'programs', where, params, 'ORDER BY date ASC, start_time ASC');
  return ok(c, { count: list.length, data: progOut(c, list) });
});
app.get('/api/programs/today', async (c) => {
  const [s, e] = dayRange(new Date());
  const list = await query(c.env.DB, 'programs', "status = 'published' AND date >= ? AND date <= ?", [s, e], 'ORDER BY start_time ASC');
  return ok(c, { count: list.length, data: progOut(c, list) });
});
app.get('/api/programs/admin/all', ...admin, async (c) => {
  const list = await query(c.env.DB, 'programs', '', [], 'ORDER BY date DESC, start_time ASC');
  return ok(c, { count: list.length, data: progOut(c, list) });
});
app.get('/api/programs/:id', async (c) => {
  const p = await findById(c.env.DB, 'programs', c.req.param('id'));
  if (!p) fail(404, 'Program not found');
  return ok(c, { data: out(c, p) });
});
app.post('/api/programs', ...admin, async (c) => ok(c, { data: out(c, await insert(c.env.DB, 'programs', await body(c))) }, 201));
app.put('/api/programs/:id', ...admin, async (c) => {
  const p = await update(c.env.DB, 'programs', c.req.param('id'), await body(c));
  if (!p) fail(404, 'Program not found');
  return ok(c, { data: out(c, p) });
});
app.delete('/api/programs/:id', ...admin, async (c) => {
  if (!(await remove(c.env.DB, 'programs', c.req.param('id')))) fail(404, 'Program not found');
  return ok(c, { data: {} });
});

// ---------- users (admin) ----------
app.get('/api/users', ...admin, async (c) => {
  const { page = 1, limit = 10, search = '', role = 'all', status = 'all' } = c.req.query();
  const where = [];
  const params = [];
  if (role !== 'all') { where.push('role = ?'); params.push(role); }
  if (status === 'active') where.push('is_active = 1');
  else if (status === 'inactive') where.push('is_active = 0');
  if (search) { where.push('(name LIKE ? OR mobile LIKE ? OR place LIKE ?)'); params.push(...Array(3).fill(`%${search}%`)); }
  const w = where.join(' AND ');
  const lim = Math.max(parseInt(limit, 10) || 10, 1);
  const pg = Math.max(parseInt(page, 10) || 1, 1);
  const users = await query(c.env.DB, 'users', w, params, `ORDER BY created_at DESC LIMIT ${lim} OFFSET ${(pg - 1) * lim}`);
  const total = await count(c.env.DB, 'users', w, params);
  const keys = ['name', 'mobile', 'place', 'gender', 'role', 'isActive', 'createdAt', 'lastLogin'];
  return ok(c, { count: users.length, total, page: pg, pages: Math.ceil(total / lim), data: users.map((u) => pick(u, keys)) });
});

app.get('/api/users/admin/overview', ...admin, async (c) => {
  const db = c.env.DB;
  const [totalUsers, activeUsers, totalBooths, totalFeedback, totalQuizAttempts, guestAttempts, registeredAttempts] = await Promise.all([
    count(db, 'users', "role = 'user'"), count(db, 'users', "role = 'user' AND is_active = 1"), count(db, 'booths'),
    count(db, 'feedback'), count(db, 'quiz_attempts'), count(db, 'quiz_attempts', "user_type = 'guest'"), count(db, 'quiz_attempts', "user_type = 'registered'")
  ]);
  const recentUsers = (await query(db, 'users', "role = 'user'", [], 'ORDER BY created_at DESC LIMIT 5'))
    .map((u) => pick(u, ['name', 'mobile', 'place', 'gender', 'createdAt', 'lastLogin', 'isActive']));
  const attempts = await query(db, 'quiz_attempts', '', [], 'ORDER BY attempt_date DESC LIMIT 5');
  const users = await byIds(db, 'users', attempts.map((a) => a.user));
  const guests = await byIds(db, 'guest_users', attempts.map((a) => a.guestUser));
  const recentQuizAttempts = attempts.map((a) => ({
    ...a,
    user: users.has(a.user) ? pick(users.get(a.user), ['name', 'mobile']) : a.user,
    guestUser: guests.has(a.guestUser) ? pick(guests.get(a.guestUser), ['name', 'mobile', 'place', 'age']) : a.guestUser
  }));
  return ok(c, {
    data: { stats: { totalUsers, activeUsers, totalBooths, totalFeedback, totalQuizAttempts, guestAttempts, registeredAttempts }, recentUsers, recentQuizAttempts }
  });
});

app.all('/api/*', (c) => c.json({ success: false, message: 'Route not found' }, 404));

export default app;
