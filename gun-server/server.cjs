const Gun = require("gun");
const express = require("express");

const app = express();

app.use(Gun.serve);

// 🔥 TAMBAHKAN INI
app.get("/", (req, res) => {
  res.send("Gun relay is running 🚀");
});

const port = process.env.PORT || 8765;

const server = app.listen(port, () =>
  console.log("Gun relay running on port " + port)
);

const gun = Gun({
  web: server,
  file: "data",
  radisk: true,
});

module.exports = { gun, server };