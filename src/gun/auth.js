// src/gun/auth.js
// Helper autentikasi: login, register, logout, cek sesi

import gun from "./gun.js";

const user = gun.user();

/**
 * Daftarkan akun baru lalu langsung login
 * @returns Promise<{ pub, alias }>
 */
export function register(alias, password) {
  return new Promise((resolve, reject) => {
    user.create(alias.trim(), password, (ack) => {
      if (ack.err) return reject(new Error(ack.err));
      // langsung auth setelah create
      user.auth(alias.trim(), password, (authAck) => {
        if (authAck.err) return reject(new Error(authAck.err));
        const pub = user.is?.pub ?? "";
        _saveSession(pub, alias.trim());
        resolve({ pub, alias: alias.trim() });
      });
    });
  });
}

/**
 * Login akun yang sudah ada
 * @returns Promise<{ pub, alias }>
 */
export function login(alias, password) {
  return new Promise((resolve, reject) => {
    user.auth(alias.trim(), password, (ack) => {
      if (ack.err) return reject(new Error(ack.err));
      const pub = user.is?.pub ?? "";
      _saveSession(pub, alias.trim());
      resolve({ pub, alias: alias.trim() });
    });
  });
}

/**
 * Logout: tandai offline lalu hapus sesi
 */
export function logout() {
  const session = getSession();
  if (session?.pub) {
    // tandai offline di presence
    gun.get("app/presence").get(session.pub).put({
      online: false,
      lastSeen: Date.now(),
    });
  }
  user.leave();
  localStorage.removeItem("chat_user");
}

/**
 * Ambil sesi dari localStorage
 * @returns { pub, alias } | null
 */
export function getSession() {
  try {
    return JSON.parse(localStorage.getItem("chat_user")) ?? null;
  } catch {
    return null;
  }
}

/**
 * Kembalikan instance gun.user() aktif
 */
export function getUser() {
  return user;
}

// ─── private ──────────────────────────────────────────────────────────────
function _saveSession(pub, alias) {
  localStorage.setItem("chat_user", JSON.stringify({ pub, alias }));
}