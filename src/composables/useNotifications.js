// src/composables/useNotifications.js
// Sistem notifikasi terpusat:
// - Badge angka di sidebar (group & per-user private)
// - Toast popup di pojok kanan atas
// - Browser Notification API (jika diizinkan)

import { ref, reactive } from "vue";

// ── State global (shared di seluruh app) ────────────────────────────────────

/** Toast list: [{ id, title, body, type }] */
export const toasts = ref([]);

/**
 * Unread counts:
 * {
 *   group: 3,                  // pesan grup belum dibaca
 *   private: { pubX: 2, ... }  // pesan private per-user
 * }
 */
export const unread = reactive({
  group:   0,
  private: {},   // key = pub lawan bicara
});

// ── Toast helpers ────────────────────────────────────────────────────────────

let _toastId = 0;

/**
 * Tampilkan toast
 * @param {string} title  - Nama pengirim / judul
 * @param {string} body   - Isi pesan (dipotong jika panjang)
 * @param {'group'|'private'} type
 */
export function showToast(title, body, type = "group") {
  const id = ++_toastId;
  const preview = body.length > 60 ? body.slice(0, 57) + "…" : body;
  toasts.value.push({ id, title, body: preview, type });
  // Auto-dismiss setelah 4 detik
  setTimeout(() => dismissToast(id), 4000);
}

export function dismissToast(id) {
  const idx = toasts.value.findIndex((t) => t.id === id);
  if (idx !== -1) toasts.value.splice(idx, 1);
}

// ── Unread helpers ────────────────────────────────────────────────────────────

export function incrementGroup() {
  unread.group++;
}

export function clearGroup() {
  unread.group = 0;
}

export function incrementPrivate(pub) {
  unread.private[pub] = (unread.private[pub] ?? 0) + 1;
}

export function clearPrivate(pub) {
  unread.private[pub] = 0;
}

export function totalUnread() {
  const privSum = Object.values(unread.private).reduce((a, b) => a + b, 0);
  return unread.group + privSum;
}

// ── Browser Notification API ─────────────────────────────────────────────────

export async function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

export function sendBrowserNotification(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (document.visibilityState === "visible") return; // hanya saat tab tidak aktif
  new Notification(title, {
    body,
    icon: "/vite.svg",
    badge: "/vite.svg",
  });
}