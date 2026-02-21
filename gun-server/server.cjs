const express = require("express");
const http = require("http");
const Gun = require("gun");

const app = express();
const server = http.createServer(app);

// ⭐ WAJIB: expose /gun endpoint
app.use(Gun.serve);

app.get("/", (req, res) => {
  res.send("Gun relay is running 🚀");
});

// ⭐ attach websocket
Gun({
  web: server,
  file: "data",
});

const PORT = process.env.PORT || 8765;

server.listen(PORT, () => {
  console.log("Running on", PORT);
});