const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const PDFDocument = require("pdfkit");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// ---- storage (flat JSON files - no external database needed) ----
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const PROJECTS_DIR = path.join(DATA_DIR, "projects");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]");

function readUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}
function projectFile(username) {
  return path.join(PROJECTS_DIR, username.replace(/[^a-z0-9_-]/gi, "_") + ".json");
}

// ---- passwords: salted PBKDF2 hash, never stored in plain text ----
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 32, "sha256").toString("hex");
}

// ---- sessions: in-memory token -> username (resets when the server restarts) ----
const sessions = new Map();
function makeToken() {
  return crypto.randomBytes(24).toString("hex");
}
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const username = token && sessions.get(token);
  if (!username) return res.status(401).json({ error: "Not authenticated." });
  req.username = username;
  next();
}

// ---- auth routes ----
app.post("/api/register", (req, res) => {
  const { name, username, password } = req.body || {};
  if (!name || !username || !password) {
    return res.status(400).json({ error: "All fields are required." });
  }
  const users = readUsers();
  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({ error: "That username is already taken." });
  }
  const salt = crypto.randomBytes(16).toString("hex");
  users.push({ name, username, salt, passwordHash: hashPassword(password, salt) });
  writeUsers(users);

  const token = makeToken();
  sessions.set(token, username);
  res.json({ token, username, name });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  const users = readUsers();
  const user = users.find((u) => u.username.toLowerCase() === (username || "").toLowerCase());
  if (!user || hashPassword(password || "", user.salt) !== user.passwordHash) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }
  const token = makeToken();
  sessions.set(token, user.username);
  res.json({ token, username: user.username, name: user.name });
});

app.post("/api/logout", authMiddleware, (req, res) => {
  const token = (req.headers.authorization || "").slice(7);
  sessions.delete(token);
  res.json({ ok: true });
});

// ---- project details ----
app.get("/api/project", authMiddleware, (req, res) => {
  const file = projectFile(req.username);
  if (!fs.existsSync(file)) return res.json(null);
  res.json(JSON.parse(fs.readFileSync(file, "utf8")));
});

app.post("/api/project", authMiddleware, (req, res) => {
  const data = req.body || {};
  if (!data.title || !data.abstract || !data.description || !data.literature || !data.modCount) {
    return res.status(400).json({ error: "Complete all required fields." });
  }
  if (!Array.isArray(data.modules) || data.modules.some((m) => !m.name)) {
    return res.status(400).json({ error: "Give every module a name." });
  }
  fs.writeFileSync(projectFile(req.username), JSON.stringify(data, null, 2));
  res.json({ ok: true });
});

// ---- PDF report, generated server-side and streamed to the browser ----
app.post("/api/project/report", authMiddleware, (req, res) => {
  const file = projectFile(req.username);
  if (!fs.existsSync(file)) {
    return res.status(404).json({ error: "Save your project details first." });
  }
  const data = JSON.parse(fs.readFileSync(file, "utf8"));

  const doc = new PDFDocument({ margin: 48 });
  const filename =
    (data.title || "project_report").replace(/[^a-z0-9]+/gi, "_").toLowerCase() + ".pdf";
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);

  doc.fontSize(20).font("Helvetica-Bold").text("Project Report");
  doc.moveDown(0.3);
  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor("#666")
    .text(`Submitted by: ${req.username}  |  Generated: ${new Date().toLocaleDateString()}`);
  doc.fillColor("#000").moveDown(1);

  function section(title, body) {
    doc.fontSize(13).font("Helvetica-Bold").text(title);
    doc
      .moveTo(doc.x, doc.y + 2)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y + 2)
      .strokeColor("#ccc")
      .stroke();
    doc.moveDown(0.6);
    doc.fontSize(10.5).font("Helvetica").fillColor("#000").text(body || "-");
    doc.moveDown(1);
  }

  section("Project Title", data.title);
  section("Abstract", data.abstract);
  section("Project Description", data.description);
  section("Literature Survey", data.literature);
  if (data.other) section("Other Details", data.other);

  doc.fontSize(13).font("Helvetica-Bold").text(`Modules (${data.modCount})`);
  doc
    .moveTo(doc.x, doc.y + 2)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 2)
    .strokeColor("#ccc")
    .stroke();
  doc.moveDown(0.6);
  (data.modules || []).forEach((m, i) => {
    doc.fontSize(11).font("Helvetica-Bold").text(`${i + 1}. ${m.name}`);
    doc.fontSize(10.5).font("Helvetica").text(m.detail || "-");
    doc.moveDown(0.6);
  });

  doc
    .fontSize(8.5)
    .font("Helvetica-Oblique")
    .fillColor("#888")
    .text("Developed by Y. Saran, RS. Vishal, K.B. Navin", 48, doc.page.height - 40);

  doc.end();
});

app.listen(PORT, () => {
  console.log(`Project Report Portal running at http://localhost:${PORT}`);
});
