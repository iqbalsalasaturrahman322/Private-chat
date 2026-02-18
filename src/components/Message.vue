<!-- src/components/Message.vue -->
<template>
  <div class="message-row" :class="isMine ? 'mine' : 'other'">

    <!-- Avatar (pesan orang lain) -->
    <div v-if="!isMine" class="avatar">{{ initial(msg.alias) }}</div>

    <div class="bubble-group">
      <!-- Nama pengirim -->
      <div v-if="!isMine" class="sender-name">{{ msg.alias }}</div>

      <!-- Bubble + action buttons -->
      <div class="bubble-wrap">

        <!-- Action buttons (muncul saat hover) -->
        <div class="action-btns" :class="{ 'action-mine': isMine }">
          <!-- Tombol reply (semua orang bisa) -->
          <button
            v-if="!isDeleted"
            class="btn-action"
            title="Balas pesan"
            @click="doReply"
          >↩</button>
          <!-- Tombol hapus (hanya milik sendiri) -->
          <button
            v-if="isMine && !isDeleted"
            class="btn-action btn-del"
            title="Hapus pesan"
            @click="confirmDelete"
          >🗑</button>
        </div>

        <!-- ── Bubble ── -->
        <div class="bubble" :class="{ deleted: isDeleted, 'bubble-image': isImage, 'bubble-audio': isAudio }">

          <!-- Quote / reply preview -->
          <div v-if="msg.replyTo && !isDeleted" class="reply-quote" @click="scrollToReplied">
            <div class="reply-bar"></div>
            <div class="reply-content">
              <span class="reply-name">{{ msg.replyTo.alias }}</span>
              <span class="reply-preview">{{ replyPreviewText }}</span>
            </div>
          </div>

          <!-- Pesan dihapus -->
          <span v-if="isDeleted" class="deleted-text">⛔ Pesan dihapus</span>

          <!-- Foto -->
          <template v-else-if="isImage">
            <img :src="msg.image" class="msg-image" @click="openLightbox" alt="foto" />
          </template>

          <!-- Voice Note -->
          <template v-else-if="isAudio">
            <div class="audio-player">
              <button class="play-btn" @click="toggleAudio">{{ isPlaying ? '⏸' : '▶' }}</button>
              <div class="audio-progress" @click="seekAudio">
                <div class="audio-bar">
                  <div class="audio-fill" :style="{ width: progress + '%' }"></div>
                </div>
              </div>
              <span class="audio-time">{{ audioTimeDisplay }}</span>
            </div>
            <audio ref="audioEl" :src="msg.audio" @timeupdate="onTimeUpdate" @ended="onEnded" />
          </template>

          <!-- Teks biasa -->
          <span v-else>{{ msg.text }}</span>
        </div>
      </div>

      <!-- Waktu -->
      <div class="timestamp">{{ formatTime(msg.timestamp) }}</div>
    </div>

    <!-- Lightbox foto -->
    <Teleport to="body">
      <Transition name="fadeAnim">
        <div v-if="showLightbox" class="lightbox" @click="showLightbox = false">
          <button class="lightbox-close" @click="showLightbox = false">✕</button>
          <img :src="msg.image" class="lightbox-img" @click.stop alt="foto" />
        </div>
      </Transition>
    </Teleport>

    <!-- Dialog konfirmasi hapus -->
    <Teleport to="body">
      <Transition name="zoomAnim">
        <div v-if="showConfirm" class="confirm-overlay" @click.self="showConfirm = false">
          <div class="confirm-box">
            <div class="confirm-icon">🗑️</div>
            <div class="confirm-title">Hapus pesan?</div>
            <div class="confirm-msg">Pesan akan ditandai sebagai dihapus untuk semua orang.</div>
            <div class="confirm-actions">
              <button class="btn-cancel" @click="showConfirm = false">Batal</button>
              <button class="btn-confirm" @click="doDelete">Hapus</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";

const props = defineProps({
  msg:    { type: Object,  required: true },
  isMine: { type: Boolean, default: false },
});
const emit = defineEmits(["delete", "reply"]);

// ── State ──────────────────────────────────────────────────────────────────
const showConfirm  = ref(false);
const showLightbox = ref(false);
const audioEl      = ref(null);
const isPlaying    = ref(false);
const progress     = ref(0);
const audioTimeDisplay = ref("0:00");

// ── Computed ───────────────────────────────────────────────────────────────
const isDeleted = computed(() =>
  props.msg.deleted === true ||
  (props.msg.text == null && props.msg.image == null && props.msg.audio == null && props.msg.pub != null)
);
const isImage = computed(() => !isDeleted.value && !!props.msg.image);
const isAudio = computed(() => !isDeleted.value && !!props.msg.audio);

// Teks preview untuk quote
const replyPreviewText = computed(() => {
  const r = props.msg.replyTo;
  if (!r) return "";
  if (r.image) return "📷 Foto";
  if (r.audio) return "🎙 Voice Note";
  if (r.deleted) return "⛔ Pesan dihapus";
  return r.text?.slice(0, 60) ?? "";
});

// ── Helpers ────────────────────────────────────────────────────────────────
const initial    = (alias = "") => (alias[0] ?? "?").toUpperCase();
const formatTime = (ts) => {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
};
const formatDuration = (s) => {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

// ── Reply ──────────────────────────────────────────────────────────────────
const doReply = () => {
  emit("reply", {
    id:      props.msg.id,
    alias:   props.msg.alias,
    text:    props.msg.text,
    image:   props.msg.image ?? null,
    audio:   props.msg.audio ? true : null,
    deleted: props.msg.deleted ?? false,
  });
};

// Scroll ke pesan yang di-reply
const scrollToReplied = () => {
  const el = document.getElementById(`msg-${props.msg.replyTo?.id}`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("highlight");
    setTimeout(() => el.classList.remove("highlight"), 1500);
  }
};

// ── Hapus ──────────────────────────────────────────────────────────────────
const confirmDelete = () => { showConfirm.value = true; };
const doDelete      = () => { showConfirm.value = false; emit("delete", props.msg.id); };

// ── Lightbox ───────────────────────────────────────────────────────────────
const openLightbox = () => { showLightbox.value = true; };

// ── Audio player ───────────────────────────────────────────────────────────
const toggleAudio = () => {
  if (!audioEl.value) return;
  if (isPlaying.value) { audioEl.value.pause(); isPlaying.value = false; }
  else                 { audioEl.value.play();  isPlaying.value = true;  }
};
const onTimeUpdate = () => {
  if (!audioEl.value) return;
  const dur = audioEl.value.duration || props.msg.duration || 1;
  progress.value         = (audioEl.value.currentTime / dur) * 100;
  audioTimeDisplay.value = formatDuration(audioEl.value.currentTime);
};
const onEnded = () => {
  isPlaying.value = false; progress.value = 0;
  if (audioEl.value) audioEl.value.currentTime = 0;
  audioTimeDisplay.value = formatDuration(props.msg.duration ?? 0);
};
const seekAudio = (e) => {
  if (!audioEl.value?.duration) return;
  const r = e.currentTarget.getBoundingClientRect();
  audioEl.value.currentTime = ((e.clientX - r.left) / r.width) * audioEl.value.duration;
};
</script>

<style scoped>
/* ── Row ────────────────────────────────────────────────────────────────── */
.message-row {
  display: flex; align-items: flex-end; gap: 6px; max-width: 100%;
}
.message-row.mine  { flex-direction: row-reverse; align-self: flex-end; }
.message-row.other { align-self: flex-start; }

/* ── Avatar ─────────────────────────────────────────────────────────────── */
.avatar {
  width: 28px; height: 28px; min-width: 28px; border-radius: 50%;
  background: #c0392b; color: #fff; font-size: 12px; font-weight: bold;
  display: flex; align-items: center; justify-content: center; margin-bottom: 16px;
}

/* ── Bubble group ───────────────────────────────────────────────────────── */
.bubble-group { display: flex; flex-direction: column; gap: 2px; }
.sender-name  { font-size: 11px; color: #aaa; padding-left: 3px; }

/* ── Bubble wrap ────────────────────────────────────────────────────────── */
.bubble-wrap {
  position: relative; display: flex; align-items: center; gap: 4px;
}

/* ── Action buttons (reply + delete) ───────────────────────────────────── */
.action-btns {
  display: flex; flex-direction: column; gap: 3px;
  opacity: 0; transition: opacity 0.15s;
  /* Untuk pesan orang lain: di kanan bubble */
  order: 1;
}
/* Untuk pesan sendiri (mine): di kiri bubble */
.action-btns.action-mine { order: -1; }

.bubble-wrap:hover .action-btns { opacity: 1; }

.btn-action {
  width: 26px; height: 26px;
  background: #3a3a3a; border: 1px solid #555;
  border-radius: 6px; color: #ccc; font-size: 13px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0; padding: 0;
}
.btn-action:hover      { background: #505050; color: #fff; }
.btn-action.btn-del:hover { background: rgba(231,76,60,0.25); color: #e74c3c; border-color: #e74c3c; }

/* ── Bubble ─────────────────────────────────────────────────────────────── */
.bubble {
  padding: 7px 11px; border-radius: 10px;
  font-size: 13px; line-height: 1.4;
  word-break: break-word; white-space: pre-wrap;
}
.other .bubble         { background: #555; color: #fff; border-top-left-radius: 2px; }
.mine  .bubble         { background: #2980b9; color: #fff; border-top-right-radius: 2px; }
.bubble.deleted        { background: #3a3a3a !important; opacity: 0.6; }
.deleted-text          { color: #888; font-style: italic; font-size: 12px; }
.bubble.bubble-image   { padding: 4px; overflow: hidden; }
.bubble.bubble-audio   { min-width: 200px; padding: 8px 12px; }

/* Highlight saat diklik dari reply quote */
:global(.highlight) {
  animation: highlightPulse 1.5s ease;
}
@keyframes highlightPulse {
  0%,100% { box-shadow: none; }
  30%     { box-shadow: 0 0 0 4px rgba(39,174,96,0.5); border-radius: 10px; }
}

/* ── Reply quote (di dalam bubble) ─────────────────────────────────────── */
.reply-quote {
  display: flex; gap: 6px;
  background: rgba(0,0,0,0.2); border-radius: 6px;
  padding: 5px 8px; margin-bottom: 6px;
  cursor: pointer; transition: background 0.15s;
  max-width: 220px; overflow: hidden;
}
.reply-quote:hover { background: rgba(0,0,0,0.35); }

.reply-bar {
  width: 3px; min-width: 3px; border-radius: 2px;
  background: #fff; opacity: 0.7; flex-shrink: 0;
}
.reply-content { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.reply-name {
  font-size: 11px; font-weight: bold; color: rgba(255,255,255,0.9);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.reply-preview {
  font-size: 11px; color: rgba(255,255,255,0.65);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* ── Foto ───────────────────────────────────────────────────────────────── */
.msg-image {
  display: block; max-width: 240px; max-height: 240px;
  width: 100%; object-fit: cover; border-radius: 8px;
  cursor: pointer; transition: opacity 0.15s;
}
.msg-image:hover { opacity: 0.9; }

/* ── Audio player ───────────────────────────────────────────────────────── */
.audio-player { display: flex; align-items: center; gap: 8px; }
.play-btn {
  width: 34px; height: 34px; border-radius: 50%;
  background: rgba(255,255,255,0.2); border: none; color: #fff;
  font-size: 16px; cursor: pointer; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.play-btn:hover { background: rgba(255,255,255,0.35); }
.audio-progress { flex: 1; cursor: pointer; padding: 8px 0; }
.audio-bar { height: 4px; background: rgba(255,255,255,0.25); border-radius: 2px; overflow: hidden; }
.audio-fill { height: 100%; background: #fff; border-radius: 2px; transition: width 0.1s linear; }
.audio-time { font-size: 11px; color: rgba(255,255,255,0.8); white-space: nowrap; flex-shrink: 0; min-width: 32px; text-align: right; }
audio { display: none; }

/* ── Timestamp ──────────────────────────────────────────────────────────── */
.timestamp { font-size: 10px; color: #888; padding-right: 2px; }
.mine .timestamp  { text-align: right; }
.other .timestamp { text-align: left; padding-left: 2px; }

/* ── Lightbox ───────────────────────────────────────────────────────────── */
.lightbox {
  position: fixed; inset: 0; z-index: 3000;
  background: rgba(0,0,0,0.88);
  display: flex; align-items: center; justify-content: center; cursor: zoom-out;
}
.lightbox-close {
  position: absolute; top: 16px; right: 20px;
  background: none; border: none; color: #fff; font-size: 24px; cursor: pointer; opacity: 0.7;
}
.lightbox-close:hover { opacity: 1; }
.lightbox-img { max-width: 90vw; max-height: 90vh; border-radius: 8px; object-fit: contain; cursor: default; }

/* ── Konfirmasi hapus ───────────────────────────────────────────────────── */
.confirm-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 2000;
}
.confirm-box {
  background: #2c2c2c; border: 1px solid #555; border-radius: 10px;
  padding: 28px 24px 20px; width: 300px; text-align: center;
}
.confirm-icon  { font-size: 36px; margin-bottom: 10px; }
.confirm-title { color: #fff; font-size: 15px; font-weight: bold; margin-bottom: 6px; }
.confirm-msg   { color: #aaa; font-size: 12px; line-height: 1.5; margin-bottom: 20px; }
.confirm-actions { display: flex; gap: 10px; justify-content: center; }
.btn-cancel {
  padding: 8px 20px; border-radius: 5px; background: #444;
  border: 1px solid #666; color: #ccc; font-size: 13px; cursor: pointer; transition: background 0.15s;
}
.btn-cancel:hover  { background: #555; color: #fff; }
.btn-confirm {
  padding: 8px 20px; border-radius: 5px; background: #e74c3c;
  border: none; color: #fff; font-size: 13px; font-weight: bold; cursor: pointer; transition: background 0.15s;
}
.btn-confirm:hover { background: #c0392b; }

/* ── Animasi ────────────────────────────────────────────────────────────── */
.zoomAnim-enter-active  { animation: zoomIn 0.2s ease; }
.zoomAnim-leave-active  { animation: zoomIn 0.15s ease reverse; }
.fadeAnim-enter-active  { animation: fadeIn 0.2s ease; }
.fadeAnim-leave-active  { animation: fadeIn 0.15s ease reverse; }
@keyframes zoomIn { from{opacity:0;transform:scale(0.9)} to{opacity:1;transform:scale(1)} }
@keyframes fadeIn { from{opacity:0} to{opacity:1} }
</style>