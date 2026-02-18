<!-- src/components/chatbox.vue -->
<template>
  <div class="chatbox">

    <!-- ── Header ──────────────────────── -->
    <div class="chat-header">
      <button v-if="mode === 'private'" class="back-btn" @click="backToGroup">‹ Kembali</button>
      <div class="header-info">
        <div class="header-name" :class="{ private: mode === 'private' }">
          {{ mode === 'private' ? `💬 ${targetUser?.alias}` : 'Chat Gruop' }}
        </div>
        <div class="header-badge" :class="mode">
          {{ mode === 'private' ? 'Pribadi' : 'Gruop' }}
        </div>
      </div>
    </div>

    <!-- ── Pesan ───────────────────────── -->
    <div class="messages" ref="msgContainer">
      <div
        v-for="msg in messages"
        :key="msg.id"
        :id="`msg-${msg.id}`"
      >
        <Message
          :msg="msg"
          :isMine="msg.pub === currentUser.pub"
          @delete="deleteMessage"
          @reply="setReply"
        />
      </div>
      <div v-if="messages.length === 0" class="empty-chat">
        {{ mode === 'private'
          ? `Mulai percakapan pribadi dengan ${targetUser?.alias}`
          : 'Belum ada pesan. Mulai ngobrol!' }}
      </div>
    </div>

    <!-- ── Preview foto sebelum kirim ──── -->
    <Transition name="preview">
      <div v-if="photoPreview" class="photo-preview">
        <img :src="photoPreview" alt="preview" />
        <div class="preview-actions">
          <button class="btn-cancel-photo" @click="cancelPhoto">✕ Batal</button>
          <button class="btn-send-photo" @click="sendPhoto" :disabled="sending">
            {{ sending ? 'Mengirim...' : '📤 Kirim Foto' }}
          </button>
        </div>
      </div>
    </Transition>

    <!-- ── Reply preview bar ───────────────────── -->
    <Transition name="reply-bar">
      <div v-if="replyTo" class="reply-preview-bar">
        <div class="reply-bar-line"></div>
        <div class="reply-bar-content">
          <span class="reply-bar-name">↩ Balas {{ replyTo.alias }}</span>
          <span class="reply-bar-text">{{ replyPreviewLabel }}</span>
        </div>
        <button class="reply-bar-close" @click="cancelReply">✕</button>
      </div>
    </Transition>

    <!-- ── Input row ────────────────────── -->
    <div class="input-row">

      <!-- Tombol foto -->
      <label class="btn-attach" title="Kirim foto">
        📷
        <input
          type="file"
          accept="image/*"
          style="display:none"
          ref="fileInput"
          @change="onFileChange"
        />
      </label>

      <!-- Tombol voice note -->
      <button
        class="btn-voice"
        :class="{ recording: isRecording }"
        :title="isRecording ? 'Stop rekaman' : 'Rekam suara'"
        @click="toggleRecording"
      >
        {{ isRecording ? '⏹' : '🎙' }}
      </button>

      <!-- Indikator rekaman -->
      <div v-if="isRecording" class="recording-indicator">
        <span class="rec-dot"></span>
        {{ recordingTime }}
      </div>

      <!-- Input teks (hilang saat rekam) -->
      <input
        v-if="!isRecording"
        v-model="draft"
        class="text-input"
        :placeholder="mode === 'private' ? `Pesan ke ${targetUser?.alias}...` : 'Tulis pesan ke grup...'"
        @keyup.enter="sendMessage"
      />

      <!-- Tombol kirim teks -->
      <button v-if="!isRecording" class="send-btn" @click="sendMessage">Kirim</button>
    </div>

  </div>
</template>

<script setup>
import { ref, inject, computed, watch, nextTick, onUnmounted } from "vue";
import gun     from "../gun/gun.js";
import Message from "./Message.vue";
import {
  showToast,
  sendBrowserNotification,
  clearGroup,
  clearPrivate,
} from "../composables/useNotifications.js";

const props = defineProps({ targetUser: { type: Object, default: null } });
const emit  = defineEmits(["backToGroup"]);

const currentUser  = inject("currentUser");
const mode         = ref("group");
const messages     = ref([]);
const draft        = ref("");
const msgContainer = ref(null);
const fileInput    = ref(null);
const sending      = ref(false);

// ── Reply ─────────────────────────────────────────────────────────────────
const replyTo = ref(null); // { id, alias, text, image, audio, deleted }

const replyPreviewLabel = computed(() => {
  if (!replyTo.value) return "";
  if (replyTo.value.deleted) return "⛔ Pesan dihapus";
  if (replyTo.value.image)   return "📷 Foto";
  if (replyTo.value.audio)   return "🎙 Voice Note";
  return replyTo.value.text?.slice(0, 60) ?? "";
});

const setReply    = (msg) => { replyTo.value = msg; };
const cancelReply = ()    => { replyTo.value = null; };

// Foto preview
const photoPreview  = ref(null);
const photoBase64   = ref(null);

// Voice note
const isRecording    = ref(false);
const recordingTime  = ref("0:00");
let mediaRecorder    = null;
let audioChunks      = [];
let recordingTimer   = null;
let recordingSeconds = 0;

let activeKey = "";

// ── Helpers ──────────────────────────────────────────────────────────────
const privateKey = (a, b) => { const s = [a,b].sort(); return `app/private/${s[0]}_${s[1]}`; };

const scrollBottom = async () => {
  await nextTick();
  if (msgContainer.value) msgContainer.value.scrollTop = msgContainer.value.scrollHeight;
};

// ── Load pesan ────────────────────────────────────────────────────────────
const loadMessages = (gunKey, currentMode, peerUser = null) => {
  const capturedKey = gunKey;
  activeKey         = gunKey;
  messages.value    = [];

  if (currentMode === "group")               clearGroup();
  if (currentMode === "private" && peerUser) clearPrivate(peerUser.pub);

  let maxTs = 0;
  gun.get(gunKey).map().once((data) => {
    if (data && data.timestamp > maxTs) maxTs = data.timestamp;
  });

  setTimeout(() => {
    if (activeKey !== capturedKey) return;
    const boundary = maxTs > 0 ? maxTs : Date.now();

    gun.get(gunKey).map().on((data, id) => {
      if (activeKey !== capturedKey) return;
      if (!data) return;

      const isDeleted = data.deleted === true;
      // Pesan valid: punya text ATAU image ATAU audio ATAU sudah deleted
      const isValid = isDeleted || data.text || data.image || data.audio;
      if (!isValid) return;

      const isNew  = (data.timestamp ?? 0) > boundary;
      const isMine = data.pub === currentUser.value.pub;

      const idx = messages.value.findIndex((m) => m.id === id);
      if (idx === -1) messages.value.push({ id, ...data });
      else            messages.value[idx] = { ...messages.value[idx], ...data, id };

      messages.value.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
      scrollBottom();

      if (isNew && !isMine && !isDeleted) {
        const label = data.image ? "📷 Foto" : data.audio ? "🎙 Voice Note" : data.text;
        const title = currentMode === "group" ? `👥 Grup • ${data.alias}` : `💬 ${data.alias}`;
        showToast(title, label, currentMode);
        sendBrowserNotification(title, label);
      }
    });
  }, 500);
};

watch(
  () => props.targetUser,
  (user) => {
    if (!user) { mode.value = "group"; loadMessages("app/group-chat", "group"); }
    else { mode.value = "private"; loadMessages(privateKey(currentUser.value.pub, user.pub), "private", user); }
  },
  { immediate: true }
);

// ── Kirim teks ────────────────────────────────────────────────────────────
const sendMessage = () => {
  if (!draft.value.trim()) return;
  const { pub, alias } = currentUser.value;
  const msgId = `${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const payload = {
    text: draft.value.trim(), pub, alias, timestamp: Date.now(), type: "text",
  };
  if (replyTo.value) {
    payload.replyTo = {
      id:      replyTo.value.id,
      alias:   replyTo.value.alias,
      text:    replyTo.value.text ?? null,
      image:   replyTo.value.image ? true : null,
      audio:   replyTo.value.audio ? true : null,
      deleted: replyTo.value.deleted ?? false,
    };
  }
  gun.get(activeKey).get(msgId).put(payload);
  draft.value   = "";
  replyTo.value = null;
};

// ── Foto ──────────────────────────────────────────────────────────────────
const onFileChange = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Validasi ukuran (max 2MB agar muat di Gun)
  if (file.size > 2 * 1024 * 1024) {
    alert("Ukuran foto maksimal 2MB.");
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    photoPreview.value = ev.target.result;
    photoBase64.value  = ev.target.result;
  };
  reader.readAsDataURL(file);
  // Reset input agar file yang sama bisa dipilih lagi
  e.target.value = "";
};

const cancelPhoto = () => {
  photoPreview.value = null;
  photoBase64.value  = null;
};

const sendPhoto = async () => {
  if (!photoBase64.value || sending.value) return;
  sending.value = true;
  const { pub, alias } = currentUser.value;
  const msgId = `${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const payload = { type: "image", image: photoBase64.value, text: null, pub, alias, timestamp: Date.now() };
  if (replyTo.value) {
    payload.replyTo = {
      id: replyTo.value.id, alias: replyTo.value.alias,
      text: replyTo.value.text ?? null, image: replyTo.value.image ? true : null,
      audio: replyTo.value.audio ? true : null, deleted: replyTo.value.deleted ?? false,
    };
  }
  gun.get(activeKey).get(msgId).put(payload);
  photoPreview.value = null;
  photoBase64.value  = null;
  sending.value      = false;
  replyTo.value      = null;
};

// ── Voice Note ────────────────────────────────────────────────────────────
const toggleRecording = async () => {
  if (isRecording.value) {
    stopRecording();
  } else {
    await startRecording();
  }
};

const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks  = [];
    mediaRecorder = new MediaRecorder(stream, { mimeType: getSupportedMimeType() });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const blob     = new Blob(audioChunks, { type: mediaRecorder.mimeType });
      // Validasi ukuran (max 2MB)
      if (blob.size > 2 * 1024 * 1024) {
        alert("Rekaman terlalu panjang (max ~2 menit). Coba lebih singkat.");
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const base64   = await blobToBase64(blob);
      sendAudio(base64, mediaRecorder.mimeType);
      stream.getTracks().forEach((t) => t.stop());
    };

    mediaRecorder.start(250); // kumpulkan chunk tiap 250ms
    isRecording.value    = true;
    recordingSeconds     = 0;
    recordingTime.value  = "0:00";

    recordingTimer = setInterval(() => {
      recordingSeconds++;
      const m = Math.floor(recordingSeconds / 60);
      const s = String(recordingSeconds % 60).padStart(2, "0");
      recordingTime.value = `${m}:${s}`;
      // Auto-stop di 120 detik
      if (recordingSeconds >= 120) stopRecording();
    }, 1000);

  } catch (err) {
    alert("Tidak bisa akses mikrofon. Pastikan izin mikrofon diberikan.");
    console.error(err);
  }
};

const stopRecording = () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  clearInterval(recordingTimer);
  isRecording.value   = false;
  recordingTime.value = "0:00";
};

const sendAudio = (base64, mimeType) => {
  const { pub, alias } = currentUser.value;
  const msgId = `${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const payload = { type: "audio", audio: base64, mimeType, text: null, pub, alias, timestamp: Date.now(), duration: recordingSeconds };
  if (replyTo.value) {
    payload.replyTo = {
      id: replyTo.value.id, alias: replyTo.value.alias,
      text: replyTo.value.text ?? null, image: replyTo.value.image ? true : null,
      audio: replyTo.value.audio ? true : null, deleted: replyTo.value.deleted ?? false,
    };
  }
  gun.get(activeKey).get(msgId).put(payload);
  replyTo.value = null;
};

// ── Utilities ─────────────────────────────────────────────────────────────
const blobToBase64 = (blob) => new Promise((res) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.readAsDataURL(blob);
});

const getSupportedMimeType = () => {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
};

// ── Hapus pesan ────────────────────────────────────────────────────────────
const deleteMessage = (msgId) => {
  const msg = messages.value.find((m) => m.id === msgId);
  if (!msg) return;
  gun.get(activeKey).get(msgId).put({
    pub: msg.pub, alias: msg.alias, timestamp: msg.timestamp,
    text: null, image: null, audio: null, deleted: true,
  });
};

const backToGroup = () => emit("backToGroup");

onUnmounted(() => {
  activeKey = "__gone__";
  stopRecording();
});
</script>

<style scoped>
.chatbox {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #3b3b3b;
  overflow: hidden;
}

/* Header */
.chat-header {
  display:flex; align-items:center; gap:10px;
  padding:0 14px; background:#4a4a4a;
  border-bottom:1px solid #3a3a3a; min-height:42px;
  flex-shrink: 0;
}
.back-btn {
  background:none; border:1px solid #666; color:#ccc;
  padding:4px 10px; border-radius:4px; font-size:12px;
  cursor:pointer; transition:all 0.15s; white-space:nowrap;
}
.back-btn:hover { background:#555; color:#fff; border-color:#888; }
.header-info    { display:flex; align-items:center; gap:10px; flex:1; }
.header-name    { color:#e74c3c; font-size:14px; font-weight:bold; text-decoration:underline; }
.header-name.private { color:#27ae60; }
.header-badge   { font-size:11px; padding:2px 8px; border-radius:10px; font-weight:bold; letter-spacing:0.3px; }
.header-badge.group   { background:#555; color:#ccc; margin-left:auto; }
.header-badge.private { background:#1a4a2e; color:#27ae60; margin-left:auto; }

/* Messages */
.messages {
  min-height: 0;
  overflow-y: auto;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.empty-chat { margin:auto; color:#666; font-size:13px; text-align:center; padding:20px; }

/* ── Reply preview bar ────────────────────────────────── */
.reply-preview-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 12px;
  background: #333;
  border-top: 1px solid #3a3a3a;
  border-left: 3px solid #27ae60;
  flex-shrink: 0;
}
.reply-bar-line {
  width: 3px; min-width: 3px; height: 32px;
  background: #27ae60; border-radius: 2px; flex-shrink: 0; display: none;
}
.reply-bar-content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.reply-bar-name { font-size: 11px; font-weight: bold; color: #27ae60; }
.reply-bar-text {
  font-size: 11px; color: #aaa;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.reply-bar-close {
  background: none; border: none; color: #888;
  font-size: 16px; cursor: pointer; flex-shrink: 0; padding: 2px 6px;
  border-radius: 4px; transition: background 0.15s, color 0.15s;
}
.reply-bar-close:hover { background: #444; color: #fff; }

/* Reply bar animation */
.reply-bar-enter-active { animation: slideUpSm 0.18s ease; }
.reply-bar-leave-active { animation: slideUpSm 0.14s ease reverse; }
@keyframes slideUpSm { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }

/* ── Photo preview ────────────────────────────────────── */
.photo-preview {
  background:#2c2c2c;
  border-top:1px solid #3a3a3a;
  padding:10px 14px;
  display:flex;
  align-items:center;
  gap:12px;
  flex-shrink: 0;
}
.photo-preview img {
  width:80px; height:80px;
  object-fit:cover;
  border-radius:8px;
  border:2px solid #555;
}
.preview-actions { display:flex; flex-direction:column; gap:6px; }
.btn-cancel-photo {
  background:#444; border:1px solid #666; color:#ccc;
  padding:5px 12px; border-radius:5px; font-size:12px; cursor:pointer;
  transition:background 0.15s;
}
.btn-cancel-photo:hover { background:#555; color:#fff; }
.btn-send-photo {
  background:#27ae60; border:none; color:#fff;
  padding:5px 12px; border-radius:5px; font-size:12px;
  font-weight:bold; cursor:pointer; transition:background 0.15s;
}
.btn-send-photo:hover:not(:disabled) { background:#219a52; }
.btn-send-photo:disabled { opacity:0.6; cursor:not-allowed; }

/* Preview animation */
.preview-enter-active { animation: slideUp 0.2s ease; }
.preview-leave-active { animation: slideUp 0.15s ease reverse; }
@keyframes slideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }

/* ── Input row ────────────────────────────────────────── */
.input-row {
  display:flex; align-items:center; gap:6px;
  padding:8px 12px;
  border-top:1px solid #3a3a3a; background:#3b3b3b;
  flex-shrink: 0;
}

.btn-attach {
  width:36px; height:36px;
  background:#555; border-radius:8px;
  display:flex; align-items:center; justify-content:center;
  font-size:18px; cursor:pointer; flex-shrink:0;
  transition:background 0.15s;
}
.btn-attach:hover { background:#666; }

.btn-voice {
  width:36px; height:36px;
  background:#555; border:none; border-radius:8px;
  display:flex; align-items:center; justify-content:center;
  font-size:18px; cursor:pointer; flex-shrink:0;
  transition:background 0.15s, box-shadow 0.15s;
}
.btn-voice:hover    { background:#666; }
.btn-voice.recording {
  background:#c0392b;
  box-shadow:0 0 0 3px rgba(192,57,43,0.35);
  animation:recPulse 1s ease-in-out infinite;
}
@keyframes recPulse {
  0%,100% { box-shadow:0 0 0 3px rgba(192,57,43,0.35); }
  50%     { box-shadow:0 0 0 6px rgba(192,57,43,0.15); }
}

.recording-indicator {
  flex:1; display:flex; align-items:center; gap:8px;
  color:#e74c3c; font-size:13px; font-weight:bold;
}
.rec-dot {
  width:10px; height:10px; border-radius:50%; background:#e74c3c;
  animation:blink 1s ease-in-out infinite;
}
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }

.text-input {
  flex:1; padding:8px 11px; border-radius:5px;
  border:1px solid #666; background:#f2f2f2;
  color:#222; font-size:13px; outline:none; transition:border-color 0.2s;
}
.text-input:focus { border-color:#e74c3c; }

.send-btn {
  padding:8px 18px; background:#e74c3c; color:#fff;
  border:none; border-radius:5px; font-size:13px;
  font-weight:bold; cursor:pointer; transition:background 0.15s;
}
.send-btn:hover { background:#c0392b; }
</style>