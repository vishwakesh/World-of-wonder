const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'world.db');

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));

const db = new sqlite3.Database(DB_PATH);

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function onRun(err) {
    if (err) reject(err);
    else resolve(this);
  });
});

const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

const seedPhotos = [
  ['Alpine Morning', 'Fresh snow over the Swiss Alps.', 'nature', 'Switzerland', 'Zermatt', 'alps,snow,mountain', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80', 46.0207, 7.7491],
  ['Winter Silence', 'A quiet forest trail after snowfall.', 'nature', 'Finland', 'Rovaniemi', 'forest,winter,snow', 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=1600&q=80', 66.5039, 25.7294],
  ['Tokyo Streets', 'Evening life in central Tokyo.', 'cities', 'Japan', 'Tokyo', 'city,night,street', 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1600&q=80', 35.6762, 139.6503],
  ['Roman Stone', 'Historic architecture in Rome.', 'architecture', 'Italy', 'Rome', 'architecture,history,rome', 'https://images.unsplash.com/photo-1525874684015-58379d421a52?auto=format&fit=crop&w=1600&q=80', 41.9028, 12.4964],
  ['Maldives Light', 'Soft sunset on a tropical beach.', 'beaches', 'Maldives', 'Malé Atoll', 'beach,coast,sunset', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80', 3.2028, 73.2207],
  ['Blue Horizon', 'Open ocean under a clear sky.', 'oceans', 'Portugal', 'Azores', 'ocean,waves,blue', 'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=1600&q=80', 37.7412, -25.6756],
  ['Hidden Valley', 'A remote green valley in Nepal.', 'hidden-gems', 'Nepal', 'Mustang', 'hidden,valley,remote', 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=80', 28.9985, 83.9311],
  ['City River', 'Night skyline reflected on water.', 'cities', 'United States', 'Chicago', 'city,river,skyline', 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1600&q=80', 41.8781, -87.6298],
  ['Coastal Calm', 'Untouched coast in New Zealand.', 'beaches', 'New Zealand', 'Coromandel', 'beach,island,coast', 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1600&q=80', -36.7602, 175.4975],
  ['Temple Courtyard', 'Ancient temple architecture at sunrise.', 'architecture', 'India', 'Jaipur', 'temple,architecture,sunrise', 'https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=1600&q=80', 26.9124, 75.7873]
];

const categoryDescriptions = {
  nature: 'Mountains, forests, waterfalls, valleys, and wildlife views.',
  cities: 'Skylines, streets, neighborhoods, and urban moments.',
  architecture: 'Historic landmarks, temples, monuments, and interiors.',
  beaches: 'White sand coasts, sunsets, and island shorelines.',
  oceans: 'Waves, marine landscapes, reefs, and open-water scenes.',
  'hidden-gems': 'Quiet villages, remote viewpoints, and secret places.'
};

async function initDb() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    bio TEXT DEFAULT '',
    country TEXT DEFAULT '',
    avatar_url TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT NOT NULL,
    country TEXT NOT NULL,
    city TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    image_url TEXT NOT NULL,
    location_visibility TEXT DEFAULT 'approximate',
    status TEXT DEFAULT 'pending',
    likes_count INTEGER DEFAULT 0,
    lat REAL,
    lng REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS likes (
    user_id INTEGER NOT NULL,
    photo_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, photo_id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(photo_id) REFERENCES photos(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS saves (
    user_id INTEGER NOT NULL,
    photo_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, photo_id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(photo_id) REFERENCES photos(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(photo_id) REFERENCES photos(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS follows (
    follower_id INTEGER NOT NULL,
    following_id INTEGER NOT NULL,
    PRIMARY KEY (follower_id, following_id),
    FOREIGN KEY(follower_id) REFERENCES users(id),
    FOREIGN KEY(following_id) REFERENCES users(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_id INTEGER NOT NULL,
    user_id INTEGER,
    reason TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  const existingUsers = await get('SELECT COUNT(*) AS count FROM users');
  if (!existingUsers || existingUsers.count === 0) {
    const hash = await bcrypt.hash('demo1234', 10);
    await run('INSERT INTO users (username, password_hash, bio, country, avatar_url) VALUES (?, ?, ?, ?, ?)', [
      'wonder_admin',
      hash,
      'Photographer exploring the world.',
      'Global',
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80'
    ]);
  }

  const existingPhotos = await get('SELECT COUNT(*) AS count FROM photos');
  if (!existingPhotos || existingPhotos.count === 0) {
    for (const p of seedPhotos) {
      await run(
        `INSERT INTO photos (user_id, title, description, category, country, city, tags, image_url, location_visibility, status, lat, lng)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, 'approximate', 'approved', ?, ?)`,
        p
      );
    }
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (_req, file, cb) => {
    const safeName = `${Date.now()}-${Math.random().toString(16).slice(2)}${path.extname(file.originalname).toLowerCase()}`;
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  }
});

const categories = ['nature', 'cities', 'architecture', 'beaches', 'oceans', 'hidden-gems'];

async function getUserFromSession(sessionId) {
  if (!sessionId) return null;
  const row = await get(
    `SELECT u.id, u.username
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > datetime('now')`,
    [sessionId]
  );
  return row || null;
}

async function createSession(userId) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  await run(
    `INSERT INTO sessions (id, user_id, expires_at)
     VALUES (?, ?, datetime('now', '+7 days'))`,
    [sessionId, userId]
  );
  return sessionId;
}

async function authOptional(req, _res, next) {
  req.user = await getUserFromSession(req.cookies.auth);
  next();
}

async function authRequired(req, res, next) {
  const user = await getUserFromSession(req.cookies.auth);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  req.user = user;
  return next();
}

function ensureCsrf(req, res, next) {
  if (!req.cookies.csrf_token) {
    const token = crypto.randomBytes(24).toString('hex');
    res.cookie('csrf_token', token, { httpOnly: false, sameSite: 'strict', secure: false });
    req.cookies.csrf_token = token;
  }
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const headerToken = req.get('x-csrf-token');
    if (!headerToken || headerToken !== req.cookies.csrf_token) {
      return res.status(403).json({ error: 'CSRF token validation failed.' });
    }
  }
  return next();
}

app.use(ensureCsrf);

function normalizePhoto(row) {
  return {
    ...row,
    tags: row.tags ? row.tags.split(',').map((t) => t.trim()).filter(Boolean) : []
  };
}

function safeDeleteUpload(filename) {
  if (!filename) return;
  const uploadDir = path.join(__dirname, 'uploads');
  const filePath = path.join(uploadDir, path.basename(filename));
  if (filePath.startsWith(uploadDir) && fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/csrf', (req, res) => res.json({ csrfToken: req.cookies.csrf_token }));

app.post('/api/auth/register', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const country = String(req.body.country || '').trim().slice(0, 80);
    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-30 chars, letters/numbers/_ only.' });
    }
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    const hash = await bcrypt.hash(password, 10);
    const insert = await run('INSERT INTO users (username, password_hash, country) VALUES (?, ?, ?)', [username, hash, country]);
    const sessionId = await createSession(insert.lastID);
    res.cookie('auth', sessionId, { httpOnly: true, sameSite: 'strict', secure: false });
    return res.json({ user: { id: insert.lastID, username } });
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) return res.status(409).json({ error: 'Username already exists.' });
    return res.status(500).json({ error: 'Unable to register.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = await get('SELECT id, username, password_hash FROM users WHERE username = ?', [username]);
  if (!user) return res.status(401).json({ error: 'Invalid credentials.' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials.' });
  const sessionId = await createSession(user.id);
  res.cookie('auth', sessionId, { httpOnly: true, sameSite: 'strict', secure: false });
  return res.json({ user: { id: user.id, username: user.username } });
});

app.post('/api/auth/logout', async (req, res) => {
  if (req.cookies.auth) {
    await run('DELETE FROM sessions WHERE id = ?', [req.cookies.auth]);
  }
  res.clearCookie('auth');
  res.json({ ok: true });
});

app.get('/api/auth/me', authOptional, async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const user = await get('SELECT id, username, bio, country, avatar_url FROM users WHERE id = ?', [req.user.id]);
  return res.json({ user: user || null });
});

app.get('/api/categories', (_req, res) => {
  res.json({
    categories: categories.map((id) => ({
      id,
      name: id === 'hidden-gems' ? 'HIDDEN GEMS' : id.toUpperCase(),
      description: categoryDescriptions[id]
    }))
  });
});

app.get('/api/photos', authOptional, async (req, res) => {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 12), 1), 30);
  const offset = (page - 1) * limit;

  const where = ['p.status = ?'];
  const params = [String(req.query.status || 'approved')];

  if (req.query.category) {
    where.push('p.category = ?');
    params.push(String(req.query.category));
  }
  if (req.query.country) {
    where.push('LOWER(p.country) = LOWER(?)');
    params.push(String(req.query.country));
  }
  if (req.query.city) {
    where.push('LOWER(p.city) LIKE LOWER(?)');
    params.push(`%${String(req.query.city)}%`);
  }
  if (req.query.q) {
    where.push('(LOWER(p.title) LIKE LOWER(?) OR LOWER(p.description) LIKE LOWER(?) OR LOWER(p.tags) LIKE LOWER(?))');
    const q = `%${String(req.query.q)}%`;
    params.push(q, q, q);
  }

  let sortClause = 'p.created_at DESC';
  if (req.query.sort === 'most-liked') sortClause = 'p.likes_count DESC, p.created_at DESC';
  if (req.query.sort === 'popular') sortClause = 'p.likes_count DESC, p.created_at DESC';
  if (req.query.sort === 'random') sortClause = 'RANDOM()';

  const rows = await all(
    `SELECT p.*, u.username,
      EXISTS(SELECT 1 FROM likes l WHERE l.photo_id = p.id AND l.user_id = ?) AS liked,
      EXISTS(SELECT 1 FROM saves s WHERE s.photo_id = p.id AND s.user_id = ?) AS saved
     FROM photos p
     JOIN users u ON p.user_id = u.id
     WHERE ${where.join(' AND ')}
     ORDER BY ${sortClause}
     LIMIT ? OFFSET ?`,
    [req.user?.id || 0, req.user?.id || 0, ...params, limit, offset]
  );

  const total = await get(`SELECT COUNT(*) AS count FROM photos p WHERE ${where.join(' AND ')}`, params);

  res.json({
    page,
    limit,
    total: total.count,
    hasMore: offset + rows.length < total.count,
    photos: rows.map(normalizePhoto)
  });
});

app.get('/api/photos/random', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 1), 1), 20);
  const rows = await all(
    `SELECT p.*, u.username FROM photos p JOIN users u ON p.user_id = u.id WHERE p.status = 'approved' ORDER BY RANDOM() LIMIT ?`,
    [limit]
  );
  res.json({ photos: rows.map(normalizePhoto) });
});

app.get('/api/photos/:id', authOptional, async (req, res) => {
  const photo = await get(
    `SELECT p.*, u.username, u.avatar_url,
      EXISTS(SELECT 1 FROM likes l WHERE l.photo_id = p.id AND l.user_id = ?) AS liked,
      EXISTS(SELECT 1 FROM saves s WHERE s.photo_id = p.id AND s.user_id = ?) AS saved
     FROM photos p JOIN users u ON p.user_id = u.id
     WHERE p.id = ?`,
    [req.user?.id || 0, req.user?.id || 0, Number(req.params.id)]
  );
  if (!photo) return res.status(404).json({ error: 'Photo not found.' });

  const comments = await all(
    `SELECT c.id, c.content, c.created_at, u.username, u.avatar_url
     FROM comments c JOIN users u ON c.user_id = u.id
     WHERE c.photo_id = ? ORDER BY c.created_at DESC`,
    [photo.id]
  );

  const related = await all(
    `SELECT p.id, p.title, p.country, p.city, p.image_url
     FROM photos p
     WHERE p.status = 'approved' AND p.id != ? AND (p.category = ? OR p.country = ? OR p.city = ?)
     ORDER BY RANDOM() LIMIT 6`,
    [photo.id, photo.category, photo.country, photo.city]
  );

  res.json({ photo: normalizePhoto(photo), comments, related });
});

app.post('/api/photos', authRequired, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Image file is required.' });
    const title = String(req.body.title || '').trim().slice(0, 120);
    const description = String(req.body.description || '').trim().slice(0, 500);
    const category = String(req.body.category || '').trim();
    const country = String(req.body.country || '').trim().slice(0, 80);
    const city = String(req.body.city || '').trim().slice(0, 80);
    const tags = String(req.body.tags || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 12).join(',');
    const locationVisibility = req.body.locationVisibility === 'hidden' ? 'hidden' : 'approximate';
    const lat = req.body.lat ? Number(req.body.lat) : null;
    const lng = req.body.lng ? Number(req.body.lng) : null;

    if (!title || !country || !categories.includes(category)) {
      safeDeleteUpload(req.file.filename || req.file.path);
      return res.status(400).json({ error: 'Title, country, and valid category are required.' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;

    const result = await run(
      `INSERT INTO photos (user_id, title, description, category, country, city, tags, image_url, location_visibility, status, lat, lng)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [req.user.id, title, description, category, country, city, tags, imageUrl, locationVisibility, Number.isFinite(lat) ? lat : null, Number.isFinite(lng) ? lng : null]
    );

    res.status(201).json({
      message: 'Upload received and sent for moderation.',
      photoId: result.lastID,
      status: 'pending'
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to upload photo.' });
  }
});

app.get('/api/moderation/photos', authRequired, async (req, res) => {
  if (req.user.username !== 'wonder_admin') return res.status(403).json({ error: 'Admin only.' });
  const pending = await all(
    `SELECT p.*, u.username FROM photos p JOIN users u ON p.user_id = u.id WHERE p.status = 'pending' ORDER BY p.created_at DESC`
  );
  res.json({ photos: pending.map(normalizePhoto) });
});

app.post('/api/moderation/photos/:id/approve', authRequired, async (req, res) => {
  if (req.user.username !== 'wonder_admin') return res.status(403).json({ error: 'Admin only.' });
  await run('UPDATE photos SET status = ? WHERE id = ?', ['approved', Number(req.params.id)]);
  res.json({ ok: true });
});

app.put('/api/photos/:id', authRequired, async (req, res) => {
  const id = Number(req.params.id);
  const current = await get('SELECT * FROM photos WHERE id = ?', [id]);
  if (!current) return res.status(404).json({ error: 'Not found.' });
  if (current.user_id !== req.user.id) return res.status(403).json({ error: 'Not allowed.' });

  const title = String(req.body.title || current.title).trim().slice(0, 120);
  const description = String(req.body.description || current.description).trim().slice(0, 500);
  await run('UPDATE photos SET title = ?, description = ? WHERE id = ?', [title, description, id]);
  res.json({ ok: true });
});

app.delete('/api/photos/:id', authRequired, async (req, res) => {
  const id = Number(req.params.id);
  const current = await get('SELECT * FROM photos WHERE id = ?', [id]);
  if (!current) return res.status(404).json({ error: 'Not found.' });
  if (current.user_id !== req.user.id && req.user.username !== 'wonder_admin') {
    return res.status(403).json({ error: 'Not allowed.' });
  }

  if (current.image_url.startsWith('/uploads/')) {
    safeDeleteUpload(current.image_url);
  }

  await run('DELETE FROM photos WHERE id = ?', [id]);
  await run('DELETE FROM likes WHERE photo_id = ?', [id]);
  await run('DELETE FROM saves WHERE photo_id = ?', [id]);
  await run('DELETE FROM comments WHERE photo_id = ?', [id]);
  res.json({ ok: true });
});

app.post('/api/photos/:id/like', authRequired, async (req, res) => {
  const id = Number(req.params.id);
  const row = await get('SELECT 1 AS liked FROM likes WHERE user_id = ? AND photo_id = ?', [req.user.id, id]);
  if (row) {
    await run('DELETE FROM likes WHERE user_id = ? AND photo_id = ?', [req.user.id, id]);
    await run('UPDATE photos SET likes_count = MAX(likes_count - 1, 0) WHERE id = ?', [id]);
    return res.json({ liked: false });
  }
  await run('INSERT OR IGNORE INTO likes (user_id, photo_id) VALUES (?, ?)', [req.user.id, id]);
  await run('UPDATE photos SET likes_count = likes_count + 1 WHERE id = ?', [id]);
  return res.json({ liked: true });
});

app.post('/api/photos/:id/save', authRequired, async (req, res) => {
  const id = Number(req.params.id);
  const row = await get('SELECT 1 AS saved FROM saves WHERE user_id = ? AND photo_id = ?', [req.user.id, id]);
  if (row) {
    await run('DELETE FROM saves WHERE user_id = ? AND photo_id = ?', [req.user.id, id]);
    return res.json({ saved: false });
  }
  await run('INSERT OR IGNORE INTO saves (user_id, photo_id) VALUES (?, ?)', [req.user.id, id]);
  return res.json({ saved: true });
});

app.get('/api/saved', authRequired, async (req, res) => {
  const rows = await all(
    `SELECT p.*, u.username FROM saves s
     JOIN photos p ON p.id = s.photo_id
     JOIN users u ON p.user_id = u.id
     WHERE s.user_id = ? AND p.status = 'approved'
     ORDER BY p.created_at DESC`,
    [req.user.id]
  );
  res.json({ photos: rows.map(normalizePhoto) });
});

app.post('/api/photos/:id/comments', authRequired, async (req, res) => {
  const id = Number(req.params.id);
  const content = String(req.body.content || '').trim().slice(0, 400);
  if (!content) return res.status(400).json({ error: 'Comment cannot be empty.' });
  await run('INSERT INTO comments (photo_id, user_id, content) VALUES (?, ?, ?)', [id, req.user.id, content]);
  res.status(201).json({ ok: true });
});

app.post('/api/photos/:id/report', authOptional, async (req, res) => {
  const id = Number(req.params.id);
  const reason = String(req.body.reason || '').trim().slice(0, 300);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  await run('INSERT INTO reports (photo_id, user_id, reason) VALUES (?, ?, ?)', [id, req.user?.id || null, reason]);
  res.status(201).json({ ok: true });
});

app.get('/api/map/markers', async (_req, res) => {
  const rows = await all(
    `SELECT country, city, lat, lng, COUNT(*) as photo_count
     FROM photos
     WHERE status = 'approved' AND location_visibility != 'hidden' AND lat IS NOT NULL AND lng IS NOT NULL
     GROUP BY country, city, lat, lng`
  );
  res.json({ markers: rows });
});

app.get('/api/discovery/wonder-of-day', async (_req, res) => {
  const photo = await get(
    `SELECT p.*, u.username
     FROM photos p JOIN users u ON p.user_id = u.id
     WHERE p.status = 'approved'
     ORDER BY date(p.created_at) DESC, p.likes_count DESC, p.id DESC
     LIMIT 1`
  );
  res.json({ photo: photo ? normalizePhoto(photo) : null });
});

app.get('/api/discovery/around-world', async (_req, res) => {
  const rows = await all(
    `SELECT p.*, u.username
     FROM photos p JOIN users u ON p.user_id = u.id
     WHERE p.status = 'approved'
     ORDER BY RANDOM() LIMIT 18`
  );
  res.json({ photos: rows.map(normalizePhoto) });
});

app.get('/api/users/:username', authOptional, async (req, res) => {
  const username = String(req.params.username).toLowerCase();
  const user = await get('SELECT id, username, bio, country, avatar_url FROM users WHERE username = ?', [username]);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const uploads = await all(
    `SELECT id, title, country, city, image_url, category, likes_count, created_at
     FROM photos WHERE user_id = ? AND status = 'approved' ORDER BY created_at DESC`,
    [user.id]
  );
  const followers = await get('SELECT COUNT(*) AS count FROM follows WHERE following_id = ?', [user.id]);
  const following = await get('SELECT COUNT(*) AS count FROM follows WHERE follower_id = ?', [user.id]);
  const isFollowing = req.user
    ? await get('SELECT 1 AS yes FROM follows WHERE follower_id = ? AND following_id = ?', [req.user.id, user.id])
    : null;

  res.json({
    user,
    uploads,
    followers: followers.count,
    following: following.count,
    isFollowing: Boolean(isFollowing)
  });
});

app.post('/api/users/:username/follow', authRequired, async (req, res) => {
  const target = await get('SELECT id FROM users WHERE username = ?', [String(req.params.username).toLowerCase()]);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'Cannot follow yourself.' });

  const row = await get('SELECT 1 as yes FROM follows WHERE follower_id = ? AND following_id = ?', [req.user.id, target.id]);
  if (row) {
    await run('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [req.user.id, target.id]);
    return res.json({ following: false });
  }
  await run('INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)', [req.user.id, target.id]);
  return res.json({ following: true });
});

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Wonder of World listening on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize app', error);
    process.exit(1);
  });
