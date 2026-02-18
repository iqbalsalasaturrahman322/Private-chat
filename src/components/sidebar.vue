<!-- src/components/sidebar.vue -->
<template>
  <div class="sidebar" ref="sidebarEl" :style="{ width: sidebarWidth + 'px', minWidth: sidebarWidth + 'px', maxWidth: sidebarWidth + 'px' }" @click="closeAll">

    <!-- ── Header ──────────────────────────────────── -->
    <div class="sidebar-header">
      Server User
      <span v-if="totalBadge > 0" class="badge-total">
        {{ totalBadge > 99 ? '99+' : totalBadge }}
      </span>
    </div>

    <!-- ── USER SENDIRI ─────────────────────────────── -->
    <div class="user-item self" @click.stop="toggleSelfDD">
      <div class="avatar self-avatar">{{ initial(currentUser.alias) }}</div>
      <div class="info">
        <div class="name">{{ currentUser.alias }}</div>
        <div class="status"><span class="dot"></span> On</div>
      </div>
      <span class="caret">▾</span>

      <Transition name="dd">
        <div v-if="selfDD" class="dropdown" @click.stop>
          <div class="dd-profile">
            <div class="dd-avatar">{{ initial(currentUser.alias) }}</div>
            <div>
              <div class="dd-name">{{ currentUser.alias }}</div>
              <div class="dd-online">● Online</div>
            </div>
          </div>
          <div class="dd-divider"></div>
          <div class="dd-item danger" @click="handleLogout">
            <span class="dd-icon">🚪</span> Sign Out
          </div>
        </div>
      </Transition>
    </div>

    <!-- ── Section label ────────────────────────────── -->
    <div class="section-label">Online</div>

    <!-- ── USER LAIN ────────────────────────────────── -->
    <div v-if="otherOnline.length === 0" class="empty">
      <span class="pulse"></span> Menunggu pengguna lain...
    </div>

    <TransitionGroup name="user" tag="div" class="user-list">
      <div
        v-for="u in otherOnline"
        :key="u.pub"
        class="user-item"
        :class="{ active: activePrivatePub === u.pub }"
        @click.stop="toggleOtherDD(u.pub)"
      >
        <div class="avatar">{{ initial(u.alias) }}</div>
        <div class="info">
          <div class="name">{{ u.alias }}</div>
          <div class="status"><span class="dot"></span> On</div>
        </div>

        <!-- Badge unread private -->
        <span v-if="(unread.private[u.pub] ?? 0) > 0" class="badge-priv">
          {{ unread.private[u.pub] > 99 ? '99+' : unread.private[u.pub] }}
        </span>
        <span v-else class="arrow">›</span>

        <!-- Dropdown: Chat Pribadi -->
        <Transition name="dd">
          <div v-if="otherDD === u.pub" class="dropdown" @click.stop>
            <div class="dd-profile">
              <div class="dd-avatar">{{ initial(u.alias) }}</div>
              <div>
                <div class="dd-name">{{ u.alias }}</div>
                <div class="dd-online">● Online</div>
              </div>
            </div>
            <div class="dd-divider"></div>
            <div class="dd-item" @click="startPrivate(u)">
              <span class="dd-icon">💬</span> Chat Pribadi
            </div>
          </div>
        </Transition>
      </div>
    </TransitionGroup>

    <!-- ── Resizer handle ────────────────────────────── -->
    <div class="resizer" @mousedown="startResize"></div>

  </div>
</template>

<script setup>
import { ref, inject, computed, watch, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import gun from "../gun/gun.js";
import { logout } from "../gun/auth.js";
import {
  unread,
  incrementGroup,
  incrementPrivate,
  showToast,
  sendBrowserNotification,
} from "../composables/useNotifications.js";

const emit        = defineEmits(["openPrivate"]);
const currentUser = inject("currentUser");
const router      = useRouter();

const props = defineProps({
  activePub: { type: String, default: null },
});

// ── Resize ────────────────────────────────────────────────────────────────
const sidebarEl   = ref(null);
const sidebarWidth = ref(180);

const startResize = (e) => {
  e.preventDefault();
  const startX = e.clientX;
  const startW = sidebarWidth.value;

  const onMove = (e) => {
    const newW = Math.min(320, Math.max(120, startW + (e.clientX - startX)));
    sidebarWidth.value = newW;
  };
  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
};

// ── Presence ──────────────────────────────────────────────────────────────
const PRESENCE_KEY       = "app/presence";
const HEARTBEAT_MS       = 5_000;
const OFFLINE_TIMEOUT_MS = 15_000;

const onlineUsers      = ref([]);
const selfDD           = ref(false);
const otherDD          = ref(null);
const activePrivatePub = ref(null);

const otherOnline = computed(() =>
  onlineUsers.value.filter((u) => u.pub !== currentUser.value.pub)
);

const totalBadge = computed(() => {
  const priv = Object.values(unread.private).reduce((a, b) => a + b, 0);
  return unread.group + priv;
});

const initial = (alias = "") => (alias[0] ?? "?").toUpperCase();

const upsert = (e) => {
  const i = onlineUsers.value.findIndex((u) => u.pub === e.pub);
  if (i === -1) onlineUsers.value.push(e);
  else          onlineUsers.value[i] = e;
};
const remove = (pub) => {
  const i = onlineUsers.value.findIndex((u) => u.pub === pub);
  if (i !== -1) onlineUsers.value.splice(i, 1);
};

// ── Heartbeat ─────────────────────────────────────────────────────────────
let heartbeatTimer = null;
const sendHeartbeat = () => {
  const { pub, alias } = currentUser.value;
  if (!pub) return;
  gun.get(PRESENCE_KEY).get(pub).put({ pub, alias, lastSeen: Date.now(), online: true });
};

const presenceRef = gun.get(PRESENCE_KEY);
const startPresence = () => {
  presenceRef.map().on((data, pub) => {
    if (!data || !pub) return;
    const ok = data.online === true &&
               Date.now() - (data.lastSeen ?? 0) < OFFLINE_TIMEOUT_MS;
    if (ok) upsert({ pub, alias: data.alias ?? pub, lastSeen: data.lastSeen });
    else    remove(pub);
  });
};

// ── Background notification listeners ────────────────────────────────────
const privateKey = (a, b) => {
  const s = [a, b].sort();
  return `app/private/${s[0]}_${s[1]}`;
};

const channelBoundary = {};
const bgOff           = {};

const setupBgListener = (gunKey, type, peerPub = null, peerAlias = "") => {
  if (bgOff[gunKey]) return;

  let maxTs = 0;
  gun.get(gunKey).map().once((data) => {
    if (data && data.timestamp > maxTs) maxTs = data.timestamp;
  });

  setTimeout(() => {
    const boundary = maxTs > 0 ? maxTs : Date.now();
    channelBoundary[gunKey] = boundary;

    const ref_ = gun.get(gunKey);
    ref_.map().on((data) => {
      if (!data || !data.text) return;

      const isNew  = data.timestamp > (channelBoundary[gunKey] ?? 0);
      const isMine = data.pub === currentUser.value.pub;

      if (!isNew || isMine) return;

      channelBoundary[gunKey] = data.timestamp;

      const isActiveChannel =
        type === "group"
          ? props.activePub === null
          : props.activePub === peerPub;

      if (!isActiveChannel) {
        if (type === "group") {
          incrementGroup();
          showToast(`👥 Grup • ${data.alias}`, data.text, "group");
          sendBrowserNotification(`Grup • ${data.alias}`, data.text);
        } else {
          incrementPrivate(peerPub);
          showToast(`💬 ${data.alias}`, data.text, "private");
          sendBrowserNotification(`${peerAlias} (Pribadi)`, data.text);
        }
      }
    });

    bgOff[gunKey] = () => ref_.map().off();
  }, 500);
};

const setupGroupBg   = () => { setupBgListener("app/group-chat", "group"); };
const setupPrivateBg = () => {
  otherOnline.value.forEach((u) => {
    const key = privateKey(currentUser.value.pub, u.pub);
    setupBgListener(key, "private", u.pub, u.alias);
  });
};

watch(otherOnline, () => { setupPrivateBg(); }, { deep: true });

// ── Lifecycle ─────────────────────────────────────────────────────────────
onMounted(() => {
  sendHeartbeat();
  heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_MS);
  startPresence();
  setTimeout(() => {
    setupGroupBg();
    setupPrivateBg();
  }, 1000);
});

onUnmounted(() => {
  clearInterval(heartbeatTimer);
  const { pub, alias } = currentUser.value;
  if (pub) gun.get(PRESENCE_KEY).get(pub).put({ pub, alias, lastSeen: Date.now(), online: false });
  presenceRef.map().off();
  Object.values(bgOff).forEach((fn) => fn());
});

// ── UI ─────────────────────────────────────────────────────────────────────
const closeAll      = () => { selfDD.value = false; otherDD.value = null; };
const toggleSelfDD  = () => { selfDD.value = !selfDD.value; otherDD.value = null; };
const toggleOtherDD = (pub) => {
  otherDD.value = otherDD.value === pub ? null : pub;
  selfDD.value  = false;
};

const startPrivate = (u) => {
  otherDD.value          = null;
  activePrivatePub.value = u.pub;
  unread.private[u.pub]  = 0;
  emit("openPrivate", u);
};

const handleLogout = () => { logout(); router.push("/login"); };
</script>

<style scoped>
.sidebar {
  flex-shrink: 0;
  background: #4a4a4a;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #3a3a3a;
  overflow-y: auto;
  overflow-x: visible;
  position: relative;
  z-index: 10;
  height: 100%;
}

/* Resizer handle */
.resizer {
  position: absolute;
  right: -3px;
  top: 0;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 20;
  border-radius: 3px;
  transition: background 0.15s;
}
.resizer:hover {
  background: rgba(231, 76, 60, 0.5);
}

/* Header */
.sidebar-header {
  position: sticky; top: 0; z-index: 3;
  background: #555; color: #fff;
  font-size: 14px; font-weight: bold;
  padding: 9px 12px; text-align: center;
  border-bottom: 1px solid #3a3a3a;
  display: flex; align-items: center; justify-content: center; gap: 6px;
}

.badge-total {
  background: #e74c3c; color: #fff;
  font-size: 10px; font-weight: bold;
  padding: 1px 6px; border-radius: 10px;
  min-width: 18px; text-align: center;
  animation: badgePop 0.3s ease;
}

@keyframes badgePop {
  0%  { transform: scale(0.4); }
  70% { transform: scale(1.25); }
  100%{ transform: scale(1); }
}

/* User item */
.user-item {
  position: relative; display: flex; align-items: center; gap: 8px;
  padding: 8px 8px 8px 10px;
  cursor: pointer; border-bottom: 1px solid #3a3a3a;
  transition: background 0.15s;
}
.user-item:hover  { background: #424242; }
.user-item.active { background: #3a3a3a; border-left: 3px solid #27ae60; }
.user-item.self         { background: #424242; }
.user-item.self:hover   { background: #484848; }

/* Avatar */
.avatar {
  width: 30px; height: 30px; min-width: 30px;
  border-radius: 50%; background: #c0392b;
  color: #fff; font-size: 13px; font-weight: bold;
  display: flex; align-items: center; justify-content: center;
}
.self-avatar { border: 2px solid #888; }

/* Info */
.info { flex: 1; min-width: 0; }
.name {
  color: #fff; font-size: 12px; font-weight: bold;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.status {
  display: flex; align-items: center; gap: 4px;
  color: #bbb; font-size: 11px; margin-top: 2px;
}
.dot { width: 8px; height: 8px; background: #27ae60; border-radius: 50%; flex-shrink: 0; }
.arrow { color: #888; font-size: 20px; line-height: 1; }
.caret { color: #aaa; font-size: 11px; margin-left: auto; }

/* Badge private */
.badge-priv {
  background: #27ae60; color: #fff;
  font-size: 10px; font-weight: bold;
  padding: 1px 6px; border-radius: 10px;
  min-width: 18px; text-align: center;
  flex-shrink: 0; animation: badgePop 0.3s ease;
}

/* Section */
.section-label {
  padding: 5px 12px 4px;
  font-size: 10px; color: #888;
  text-transform: uppercase; letter-spacing: 0.6px;
  background: #444; border-bottom: 1px solid #3a3a3a;
}

/* Empty */
.empty {
  display: flex; align-items: center; gap: 8px;
  padding: 12px; color: #777; font-size: 11px;
}
.pulse {
  width: 7px; height: 7px; border-radius: 50%;
  background: #27ae60; flex-shrink: 0;
  animation: pulse 1.4s ease-in-out infinite;
}
@keyframes pulse {
  0%,100% { opacity:1; transform:scale(1); }
  50%     { opacity:0.3; transform:scale(0.75); }
}

/* User list */
.user-list { display: flex; flex-direction: column; }

/* Dropdown */
.dropdown {
  position: absolute; top: 100%; left: 0; width: 210px;
  background: #2c2c2c; border: 1px solid #555; border-radius: 7px;
  box-shadow: 4px 6px 24px rgba(0,0,0,0.65);
  overflow: hidden; z-index: 999;
}
.dd-profile { display: flex; align-items: center; gap: 10px; padding: 12px 14px 10px; }
.dd-avatar {
  width: 34px; height: 34px; border-radius: 50%; background: #c0392b;
  color: #fff; font-size: 15px; font-weight: bold;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.dd-name   { color: #fff; font-size: 13px; font-weight: bold; }
.dd-online { color: #27ae60; font-size: 11px; margin-top: 2px; }
.dd-item {
  display: flex; align-items: center; gap: 9px;
  padding: 10px 14px; color: #ddd; font-size: 13px;
  cursor: pointer; transition: background 0.15s;
}
.dd-item:hover        { background: #383838; color: #fff; }
.dd-item.danger       { color: #e74c3c; }
.dd-item.danger:hover { background: #3d2020; }
.dd-icon              { font-size: 15px; }
.dd-divider           { height: 1px; background: #3d3d3d; }

/* Animasi */
.dd-enter-active    { animation: ddIn 0.15s ease; }
.dd-leave-active    { animation: ddIn 0.12s ease reverse; }
.user-enter-active  { animation: slideIn 0.2s ease; }
.user-leave-active  { animation: slideOut 0.2s ease; }

@keyframes ddIn     { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
@keyframes slideIn  { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
@keyframes slideOut { from{opacity:1;transform:translateX(0)} to{opacity:0;transform:translateX(-12px)} }
</style>