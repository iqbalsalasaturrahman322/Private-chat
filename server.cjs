const Gun = require("gun");
const express = require("express");
const path = require("path");

const app = express();

app.use(Gun.serve);
app.use(express.static(__dirname));

const server = app.listen(8765, () =>
  console.log("Gun relay running on port 8765")
);

const gun = Gun({
  web: server,
  file: "data",
  radisk: true,
});

module.exports = { gun, server };