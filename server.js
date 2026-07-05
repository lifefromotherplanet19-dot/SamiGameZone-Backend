const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const app = express();
app.use(cors());
app.use(express.json());

// ================= 📁 STATIC FILES =================
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
app.use('/uploads', express.static(UPLOADS_DIR));

// ================= 📤 MULTER SETUP =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Images only!'));
  }
});

// ================= 🔑 SECRET =================
const JWT_SECRET = 'sami_game_zone_2026';

// ================= 📁 DATABASE =================
const DB_DIR = path.join(__dirname, 'database');
const GAMES_FILE = path.join(DB_DIR, 'games.json');
const USERS_FILE = path.join(DB_DIR, 'users.json');
const NEWS_FILE = path.join(DB_DIR, 'news.json');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR);
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

// ================= 🛡️ AUTH MIDDLEWARE =================
const auth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: '❌ Token required!' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ message: '❌ Invalid token!' });
  }
};

// ================= 🎮 GAMES API =================
app.get('/api/games', (req, res) => res.json(readGames()));

app.post('/api/games', auth, upload.single('image'), (req, res) => {
  const games = readGames();
  const imageUrl = req.files?.image
  ? `https://samigamezone-backend-2.onrender.com/uploads/${req.files.image[0].filename}`
  : req.body.imageUrl || '';

const gameFileUrl = req.files?.gamefile
  ? `https://samigamezone-backend-2.onrender.com/gamefiles/${req.files.gamefile[0].filename}`
  : '';
  const game = {
    id: Date.now().toString(),
    title: req.body.title,
    description: req.body.description,
    size: req.body.size || '',
    downloadLink: req.body.downloadLink,
    imageUrl,
    category: req.body.category,
    createdAt: new Date().toISOString()
  };
  const games = readGames();
  const game = games.find(g => g.id === req.params.id);
  if (game?.imageUrl?.includes('/uploads/')) {
    const filename = game.imageUrl.split('/uploads/')[1];
    const filePath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  writeGames(games.filter(g => g.id !== req.params.id));
  res.json({ message: '✅ Deleted!' });
});

// ================= 📰 NEWS API =================
app.get('/api/news', (req, res) => res.json(readNews()));

app.post('/api/news', auth, (req, res) => {
  const news = readNews();
  const item = {
    id: Date.now().toString(),
    title: req.body.title,
    content: req.body.content,
    createdAt: new Date().toISOString()
  };
  news.unshift(item);
  writeNews(news);
  res.status(201).json({ message: '✅ News added!', item });
});

app.delete('/api/news/:id', auth, (req, res) => {
  writeNews(readNews().filter(n => n.id !== req.params.id));
  res.json({ message: '✅ News deleted!' });
});

// ================= 🔐 AUTH =================
app.post('/api/auth/login', async (req, res) => {
  const user = readUsers().find(u => u.email === req.body.email);
  if (!user || !await bcrypt.compare(req.body.password, user.password)) {
    return res.status(401).json({ message: '❌ Username ወይም Password ትክክል አይደለም!' });
  }
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ status: 'success', token });
});

app.post('/api/auth/register', (req, res) => {
  res.status(403).json({ message: '❌ Registration disabled!' });
});

// ================= 🚀 START =================
app.post('/api/auth/register', (req, res) => {
  res.status(403).json({
    message: '❌ Registration disabled!'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
  const imageUrl = req.file
    ? `https://samigamezone-backend-2.onrender.com/uploads/${req.file.filename}`
    : (req.body.imageUrl || '');

  const game = {
    id: Date.now().toString(),
    title: req.body.title,
    description: req.body.description,
    size: req.body.size || '',
    downloadLink: req.body.downloadLink,
    imageUrl,
    category: req.body.category,
    createdAt: new Date().toISOString()
  };

  games.push(game);
  writeGames(games);

  res.status(201).json({
    message: '✅ Game added!',
    game
  });
});

const gameFileUrl = req.files?.gamefile
  ? `https://samigamezone-backend-2.onrender.com/gamefiles/${req.files.gamefile[0].filename}`
  : '';
  const game = {
    id: Date.now().toString(),
    title: req.body.title,
    description: req.body.description,
    size: req.body.size || '',
    downloadLink: req.body.downloadLink,
    imageUrl,
    category: req.body.category,
    createdAt: new Date().toISOString()
  };
  games.push(game);
  writeGames(games);
  res.status(201).json({ message: '✅ Game added!', game });
});

app.delete('/api/games/:id', auth, (req, res) => {
  const games = readGames();
  const game = games.find(g => g.id === req.params.id);
  if (game?.imageUrl?.includes('/uploads/')) {
    const filename = game.imageUrl.split('/uploads/')[1];
    const filePath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  writeGames(games.filter(g => g.id !== req.params.id));
  res.json({ message: '✅ Deleted!' });
});

// ================= 📰 NEWS API =================
app.get('/api/news', (req, res) => res.json(readNews()));

app.post('/api/news', auth, (req, res) => {
  const news = readNews();
  const item = {
    id: Date.now().toString(),
    title: req.body.title,
    content: req.body.content,
    createdAt: new Date().toISOString()
  };
  news.unshift(item);
  writeNews(news);
  res.status(201).json({ message: '✅ News added!', item });
});

app.delete('/api/news/:id', auth, (req, res) => {
  writeNews(readNews().filter(n => n.id !== req.params.id));
  res.json({ message: '✅ News deleted!' });
});

// ================= 🔐 AUTH =================
app.post('/api/auth/login', async (req, res) => {
  const user = readUsers().find(u => u.email === req.body.email);
  if (!user || !await bcrypt.compare(req.body.password, user.password)) {
    return res.status(401).json({ message: '❌ Username ወይም Password ትክክል አይደለም!' });
  }
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ status: 'success', token });
});

app.post('/api/auth/register', (req, res) => {
  res.status(403).json({ message: '❌ Registration disabled!' });
});

// ================= 🚀 START =================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

  games.push(game);

  res.json({
    message: "Game Added",
    game
  });
});

// Delete Game
app.delete("/api/games/:id", verifyToken, (req, res) => {
  games = games.filter(g => g.id !== req.params.id);

  res.json({
    message: "Deleted"
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
})
