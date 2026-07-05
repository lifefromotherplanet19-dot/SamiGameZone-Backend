const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const app = express();

// ================= 🌐 CORS - Render + Vercel =================
app.use(cors({
  origin: [
    'https://sami-game-zone.vercel.app',
    'http://localhost:5173',
    'http://localhost:5174'
  ],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// ================= 🌐 SERVER URL =================
const SERVER_URL = process.env.SERVER_URL || 'https://samigamezone-backend-2.onrender.com';
const PORT = process.env.PORT || 5000;

// ================= 📁 STATIC DIRS =================
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const FILES_DIR = path.join(__dirname, 'gamefiles');
const DB_DIR = path.join(__dirname, 'database');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/gamefiles', express.static(FILES_DIR));

// ================= 📤 MULTER =================
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`)
});
const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/;
    if (allowed.test(path.extname(file.originalname).toLowerCase()))
      cb(null, true);
    else cb(new Error('Images only!'));
  }
});

const mixedUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      if (file.fieldname === 'image') cb(null, UPLOADS_DIR);
      else cb(null, FILES_DIR);
    },
    filename: (req, file, cb) => {
      if (file.fieldname === 'image') {
        cb(null, `${Date.now()}${path.extname(file.originalname)}`);
      } else {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}_${safeName}`);
      }
    }
  }),
  limits: { fileSize: 500 * 1024 * 1024 }
}).fields([
  { name: 'image', maxCount: 1 },
  { name: 'gamefile', maxCount: 1 }
]);

// ================= 🔑 SECRET =================
const JWT_SECRET = process.env.JWT_SECRET || 'sami_game_zone_2026';

// ================= 📁 DATABASE =================
const GAMES_FILE = path.join(DB_DIR, 'games.json');
const USERS_FILE = path.join(DB_DIR, 'users.json');
const NEWS_FILE = path.join(DB_DIR, 'news.json');

if (!fs.existsSync(GAMES_FILE)) fs.writeFileSync(GAMES_FILE, '[]');
if (!fs.existsSync(NEWS_FILE)) fs.writeFileSync(NEWS_FILE, '[]');
if (!fs.existsSync(USERS_FILE)) {
  const hash = bcrypt.hashSync('admin123', 10);
  fs.writeFileSync(USERS_FILE, JSON.stringify([{ id: 1, email: 'admin', password: hash }], null, 2));
}

const readGames = () => JSON.parse(fs.readFileSync(GAMES_FILE, 'utf8'));
const writeGames = (d) => fs.writeFileSync(GAMES_FILE, JSON.stringify(d, null, 2));
const readUsers = () => JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
const readNews = () => JSON.parse(fs.readFileSync(NEWS_FILE, 'utf8'));
const writeNews = (d) => fs.writeFileSync(NEWS_FILE, JSON.stringify(d, null, 2));

// ================= 🛡️ AUTH =================
const auth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: '❌ Token required!' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(403).json({ message: '❌ Invalid token!' }); }
};

// ================= ✅ HEALTH CHECK =================
app.get('/', (req, res) => {
  res.json({ status: '✅ Sami Game Zone API is running!', url: SERVER_URL });
});

// ================= 🎮 GAMES =================
app.get('/api/games', (req, res) => res.json(readGames()));

app.post('/api/games', auth, (req, res) => {
  mixedUpload(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });

    const imageUrl = req.files?.image
      ? `${SERVER_URL}/uploads/${req.files.image[0].filename}`
      : req.body.imageUrl || '';

    const gameFileUrl = req.files?.gamefile
      ? `${SERVER_URL}/gamefiles/${req.files.gamefile[0].filename}`
      : '';

    const gameFileSize = req.files?.gamefile
      ? `${(req.files.gamefile[0].size / (1024 * 1024)).toFixed(1)} MB`
      : req.body.size || '';

    const game = {
      id: Date.now().toString(),
      title: req.body.title,
      description: req.body.description,
      size: gameFileSize,
      downloadLink: gameFileUrl || req.body.downloadLink || '',
      gameFileName: req.files?.gamefile ? req.files.gamefile[0].originalname : '',
      imageUrl,
      category: req.body.category,
      hasDirectFile: !!req.files?.gamefile,
      createdAt: new Date().toISOString()
    };

    const games = readGames();
    games.push(game);
    writeGames(games);
    res.status(201).json({ message: '✅ Game added!', game });
  });
});

app.delete('/api/games/:id', auth, (req, res) => {
  const games = readGames();
  const game = games.find(g => g.id === req.params.id);
  if (game) {
    if (game.imageUrl?.includes('/uploads/')) {
      const fp = path.join(UPLOADS_DIR, game.imageUrl.split('/uploads/')[1]);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    if (game.downloadLink?.includes('/gamefiles/')) {
      const fp = path.join(FILES_DIR, game.downloadLink.split('/gamefiles/')[1]);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
  }
  writeGames(games.filter(g => g.id !== req.params.id));
  res.json({ message: '✅ Deleted!' });
});

// ================= 📰 NEWS =================
app.get('/api/news', (req, res) => res.json(readNews()));

app.post('/api/news', auth, imageUpload.single('image'), (req, res) => {
  const imageUrl = req.file ? `${SERVER_URL}/uploads/${req.file.filename}` : '';
  const item = {
    id: Date.now().toString(),
    title: req.body.title,
    content: req.body.content,
    imageUrl,
    createdAt: new Date().toISOString()
  };
  const news = readNews();
  news.unshift(item);
  writeNews(news);
  res.status(201).json({ message: '✅ News added!', item });
});
// 👁️ View Counter
app.post('/api/games/:id/view', (req, res) => {
  const games = readGames();
  const game = games.find(g => g.id === req.params.id);
  if (game) {
    game.views = (game.views || 0) + 1;
    writeGames(games);
    res.json({ views: game.views });
  } else res.status(404).json({ message: 'Not found' });
});

// ⬇️ Download Counter
app.post('/api/games/:id/download', (req, res) => {
  const games = readGames();
  const game = games.find(g => g.id === req.params.id);
  if (game) {
    game.downloads = (game.downloads || 0) + 1;
    writeGames(games);
    res.json({ downloads: game.downloads });
  } else res.status(404).json({ message: 'Not found' });
});
app.delete('/api/news/:id', auth, (req, res) => {
  const news = readNews();
  const item = news.find(n => n.id === req.params.id);
  if (item?.imageUrl?.includes('/uploads/')) {
    const fp = path.join(UPLOADS_DIR, item.imageUrl.split('/uploads/')[1]);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  writeNews(news.filter(n => n.id !== req.params.id));
  res.json({ message: '✅ News deleted!' });
});

// ================= 🔐 AUTH =================
app.post('/api/auth/login', async (req, res) => {
  const user = readUsers().find(u => u.email === req.body.email);
  if (!user || !await bcrypt.compare(req.body.password, user.password))
    return res.status(401).json({ message: '❌ Username ወይም Password ትክክል አይደለም!' });
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ status: 'success', token });
});

app.post('/api/auth/register', (req, res) => {
  res.status(403).json({ message: '❌ Registration disabled!' });
});

// ================= 🚀 START =================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 URL: ${SERVER_URL}`);
});
