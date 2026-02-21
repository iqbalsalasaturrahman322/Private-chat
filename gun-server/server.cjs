const express = require("express");
const http = require("http");
const Gun = require("gun");

const app = express();
const server = http.createServer(app);

app.get("/", (req, res) => {
  res.send("Gun relay is running 🚀");
});

// ⛔ JANGAN pakai Gun.serve
// app.use(Gun.serve);  ← HAPUS INI

// ✅ attach gun langsung ke http server
Gun({
  web: server,
  file: "data",
});

const PORT = process.env.PORT || 8765;

server.listen(PORT, () => {
  console.log("Running on", PORT);
});