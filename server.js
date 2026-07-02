const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const multer = require("multer"); // ለምስል ፋይል

const app = express();
app.use(cors());
app.use(express.json());

const SECRET = "samigamezone_secret_key";
const upload = multer({ dest: 'uploads/' }); // ፋይሎች የሚቀመጡበት

// Admin Account
const admin = {
  email: "admin@samigamezone.com",
  password: "12345678"
};

// Memory Database
let games = [];
let news = [];

// Login Route
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (email === admin.email && password === admin.password) {
    const token = jwt.sign({ role: "admin" }, SECRET, { expiresIn: "7d" });
    return res.json({ status: "success", token });
  }
  res.status(401).json({ message: "Invalid credentials" });
});

// Middleware
function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: "No token" });
  const token = auth.split(" ")[1];
  try {
    jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

// --- GAMES API ---
app.get("/api/games", (req, res) => res.json(games));

app.post("/api/games", verifyToken, upload.single('image'), (req, res) => {
  const newGame = {
    id: Date.now().toString(),
    ...req.body,
    imageUrl: req.file ? `/uploads/${req.file.filename}` : ''
  };
  games.push(newGame);
  res.json({ status: "success", game: newGame });
});

app.delete("/api/games/:id", verifyToken, (req, res) => {
  games = games.filter(g => g.id !== req.params.id);
  res.json({ message: "Deleted" });
});

// --- NEWS API ---
app.get("/api/news", (req, res) => res.json(news));

app.post("/api/news", verifyToken, (req, res) => {
  const newNews = { id: Date.now().toString(), ...req.body, createdAt: new Date() };
  news.push(newNews);
  res.json(newNews);
});

app.delete("/api/news/:id", verifyToken, (req, res) => {
  news = news.filter(n => n.id !== req.params.id);
  res.json({ message: "Deleted" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
      message: "Invalid token"
    });
  }
}

// Add Game
app.post("/api/games", verifyToken, (req, res) => {
  const game = {
    id: Date.now().toString(),
    ...req.body
  };

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
});
