const express = require("express");
const http = require("http");
const Gun = require("gun");

const app = express();
const server = http.createServer(app); // ← penting

app.get("/", (req, res) => {
  res.send("Gun relay is running 🚀");
});

// attach gun ke http server (BUKAN app)
Gun({
  web: server,
  file: "data",
  radisk: true,
});

const PORT = process.env.PORT || 8765;

server.listen(PORT, () => {
  console.log("Running on", PORT);
});