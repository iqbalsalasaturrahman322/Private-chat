const Gun = require("gun");
const express = require("express");

const app = express();

// ROOT RESPONSE DULU
app.get("/", (req, res) => {
  res.status(200).send("Gun relay is running 🚀");
});

// Gun middleware setelah root
app.use(Gun.serve);

const port = process.env.PORT || 8765;

const server = app.listen(port, () =>
  console.log("Gun relay running on port " + port)
);

const gun = Gun({
  web: server,
  file: "data",
  radisk: true,
});