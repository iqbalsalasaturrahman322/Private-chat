<!-- src/components/ToastContainer.vue -->
<template>
  <Teleport to="body">
    <div class="toast-wrap">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="toast"
          :class="t.type"
          @click="dismissToast(t.id)"
        >
          <div class="toast-icon">
            {{ t.type === 'private' ? '💬' : '👥' }}
          </div>
          <div class="toast-body">
            <div class="toast-title">{{ t.title }}</div>
            <div class="toast-msg">{{ t.body }}</div>
          </div>
          <button class="toast-close" @click.stop="dismissToast(t.id)">✕</button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { toasts, dismissToast } from "../composables/useNotifications.js";
</script>

<style scoped>
.toast-wrap {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 280px;
  max-width: 340px;
  padding: 12px 14px;
  border-radius: 8px;
  background: #2c2c2c;
  border-left: 4px solid #888;
  box-shadow: 0 6px 24px rgba(0,0,0,0.55);
  cursor: pointer;
  pointer-events: all;
  transition: transform 0.15s, opacity 0.15s;
}

.toast:hover { transform: translateX(-4px); }

/* Warna border per tipe */
.toast.group   { border-left-color: #e74c3c; }
.toast.private { border-left-color: #27ae60; }

.toast-icon {
  font-size: 20px;
  flex-shrink: 0;
  margin-top: 1px;
}

.toast-body { flex: 1; min-width: 0; }

.toast-title {
  color: #fff;
  font-size: 13px;
  font-weight: bold;
  margin-bottom: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toast-msg {
  color: #bbb;
  font-size: 12px;
  line-height: 1.4;
  word-break: break-word;
}

.toast-close {
  background: none;
  border: none;
  color: #777;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  line-height: 1;
  margin-top: 1px;
}
.toast-close:hover { color: #fff; }

/* Animasi masuk/keluar */
.toast-enter-active {
  animation: toastIn 0.25s ease;
}
.toast-leave-active {
  animation: toastIn 0.2s ease reverse;
}

@keyframes toastIn {
  from { opacity: 0; transform: translateX(30px); }
  to   { opacity: 1; transform: translateX(0); }
}
</style>