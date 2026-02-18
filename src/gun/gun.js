// src/gun/gun.js
// Instance Gun tunggal yang dipakai seluruh aplikasi

import Gun from "gun";
import "gun/sea";
import "gun/axe";

const gun = Gun({
  peers: ["http://localhost:8765/gun"], // ganti sesuai relay server kamu
  localStorage: false,
});

export default gun;