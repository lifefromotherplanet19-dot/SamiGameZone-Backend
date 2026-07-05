const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const app = express();

app.use(cors({
  origin: ['https://sami-game-zone.vercel.app','http://localhost:5173','http://localhost:5174'],
  methods: ['GET','POST','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

app.use(express.json());

const SERVER_URL = process.env.SERVER_URL || 'https://samigamezone-backend-2.onrender.com';
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'sami_game_zone_2026';

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const FILES_DIR = path.join(__dirname, 'gamefiles');
const DB_DIR = path.join(__dirname, 'database');

[UPLOADS_DIR, FILES_DIR, DB_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/gamefiles', express.static(FILES_DIR));

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (r,f,cb) => cb(null, UPLOADS_DIR),
    filename: (r,f,cb) => cb(null, `${Date.now()}${path.extname(f.originalname)}`)
  }),
  limits: { fileSize: 10*1024*1024 }
});

const mixedUpload = multer({
  storage: multer.diskStorage({
    destination: (r,f,cb) => cb(null, f.fieldname==='image' ? UPLOADS_DIR : FILES_DIR),
    filename: (r,f,cb) => {
      if (f.fieldname==='image') cb(null, `${Date.now()}${path.extname(f.originalname)}`);
      else cb(null, `${Date.now()}_${f.originalname.replace(/[^a-zA-Z0-9._-]/g,'_')}`);
    }
  }),
  limits: { fileSize: 500*1024*1024 }
}).fields([{name:'image',maxCount:1},{name:'gamefile',maxCount:1}]);

const GAMES_FILE = path.join(DB_DIR,'games.json');
const USERS_FILE = path.join(DB_DIR,'users.json');
const NEWS_FILE  = path.join(DB_DIR,'news.json');

if (!fs.existsSync(GAMES_FILE)) fs.writeFileSync(GAMES_FILE,'[]');
if (!fs.existsSync(NEWS_FILE))  fs.writeFileSync(NEWS_FILE,'[]');
if (!fs.existsSync(USERS_FILE)) {
  const h = bcrypt.hashSync('admin123',10);
  fs.writeFileSync(USERS_FILE, JSON.stringify([{id:1,email:'admin',password:h}],null,2));
}

const readGames = () => JSON.parse(fs.readFileSync(GAMES_FILE,'utf8'));
const writeGames = d => fs.writeFileSync(GAMES_FILE, JSON.stringify(d,null,2));
const readUsers  = () => JSON.parse(fs.readFileSync(USERS_FILE,'utf8'));
const readNews   = () => JSON.parse(fs.readFileSync(NEWS_FILE,'utf8'));
const writeNews  = d => fs.writeFileSync(NEWS_FILE, JSON.stringify(d,null,2));

const auth = (req,res,next) => {
  const t = req.headers['authorization']?.split(' ')[1];
  if (!t) return res.status(401).json({message:'❌ Token required!'});
  try { req.user = jwt.verify(t,JWT_SECRET); next(); }
  catch { res.status(403).json({message:'❌ Invalid token!'}); }
};

// ✅ Health check
app.get('/', (req,res) => res.json({status:'✅ Sami Game Zone API running!'}));

// ================= 🎮 GAMES =================
app.get('/api/games', (req,res) => res.json(readGames()));

app.post('/api/games', auth, (req,res) => {
  mixedUpload(req,res,(err) => {
    if (err) return res.status(400).json({message:err.message});
    const imageUrl = req.files?.image ? `${SERVER_URL}/uploads/${req.files.image[0].filename}` : req.body.imageUrl||'';
    const gameFileUrl = req.files?.gamefile ? `${SERVER_URL}/gamefiles/${req.files.gamefile[0].filename}` : '';
    const gameFileSize = req.files?.gamefile ? `${(req.files.gamefile[0].size/(1024*1024)).toFixed(1)} MB` : req.body.size||'';
    const game = {
      id: Date.now().toString(),
      title: req.body.title,
      description: req.body.description,
      size: gameFileSize,
      downloadLink: gameFileUrl||req.body.downloadLink||'',
      imageUrl,
      category: req.body.category,
      hasDirectFile: !!req.files?.gamefile,
      views: 0,
      downloads: 0,
      createdAt: new Date().toISOString()
    };
    const games = readGames();
    games.push(game);
    writeGames(games);
    res.status(201).json({message:'✅ Game added!', game});
  });
});

// 👁️ View Counter
app.post('/api/games/:id/view', (req,res) => {
  const games = readGames();
  const game = games.find(g => g.id === req.params.id);
  if (!game) return res.status(404).json({message:'Not found'});
  game.views = (game.views||0) + 1;
  writeGames(games);
  res.json({views: game.views});
});

// ⬇️ Download Counter
app.post('/api/games/:id/download', (req,res) => {
  const games = readGames();
  const game = games.find(g => g.id === req.params.id);
  if (!game) return res.status(404).json({message:'Not found'});
  game.downloads = (game.downloads||0) + 1;
  writeGames(games);
  res.json({downloads: game.downloads});
});
// ✏️ Edit Game
app.put('/api/games/:id', auth, (req, res) => {
  const games = readGames();
  const index = games.findIndex(g => g.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: 'Game not found!' });
  games[index] = {
    ...games[index],
    title: req.body.title || games[index].title,
    description: req.body.description || games[index].description,
    size: req.body.size || games[index].size,
    downloadLink: req.body.downloadLink || games[index].downloadLink,
    imageUrl: req.body.imageUrl || games[index].imageUrl,
    category: req.body.category || games[index].category,
  };
  writeGames(games);
  res.json({ message: '✅ Game updated!', game: games[index] });
});
app.delete('/api/games/:id', auth, (req,res) => {
  const games = readGames();
  const g = games.find(x => x.id===req.params.id);
  if (g?.imageUrl?.includes('/uploads/')) { const fp=path.join(UPLOADS_DIR,g.imageUrl.split('/uploads/')[1]); if(fs.existsSync(fp)) fs.unlinkSync(fp); }
  if (g?.downloadLink?.includes('/gamefiles/')) { const fp=path.join(FILES_DIR,g.downloadLink.split('/gamefiles/')[1]); if(fs.existsSync(fp)) fs.unlinkSync(fp); }
  writeGames(games.filter(x => x.id!==req.params.id));
  res.json({message:'✅ Deleted!'});
});

// ================= 📰 NEWS =================
app.get('/api/news', (req,res) => res.json(readNews()));

app.post('/api/news', auth, imageUpload.single('image'), (req,res) => {
  const imageUrl = req.file ? `${SERVER_URL}/uploads/${req.file.filename}` : '';
  const item = { id: Date.now().toString(), title: req.body.title, content: req.body.content, imageUrl, createdAt: new Date().toISOString() };
  const news = readNews(); news.unshift(item); writeNews(news);
  res.status(201).json({message:'✅ News added!', item});
});

app.delete('/api/news/:id', auth, (req,res) => {
  const news = readNews();
  const n = news.find(x => x.id===req.params.id);
  if (n?.imageUrl?.includes('/uploads/')) { const fp=path.join(UPLOADS_DIR,n.imageUrl.split('/uploads/')[1]); if(fs.existsSync(fp)) fs.unlinkSync(fp); }
  writeNews(news.filter(x => x.id!==req.params.id));
  res.json({message:'✅ News deleted!'});
});

// ================= 🔐 AUTH =================
app.post('/api/auth/login', async (req,res) => {
  const user = readUsers().find(u => u.email===req.body.email);
  if (!user || !await bcrypt.compare(req.body.password, user.password))
    return res.status(401).json({message:'❌ Username ወይም Password ትክክል አይደለም!'});
  const token = jwt.sign({id:user.id, email:user.email}, JWT_SECRET, {expiresIn:'24h'});
  res.json({status:'success', token});
});

app.post('/api/auth/register', (req,res) => res.status(403).json({message:'❌ Registration disabled!'}));

app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
