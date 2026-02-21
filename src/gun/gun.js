// src/gun/gun.js
// Instance Gun tunggal yang dipakai seluruh aplikasi

import Gun from "gun";
import "gun/sea";
import "gun/axe";

const gun = Gun({
  peers: ["https://private-chat-production-0c71.up.railway.app/gun"],
  localStorage: false,
});

export default gun;