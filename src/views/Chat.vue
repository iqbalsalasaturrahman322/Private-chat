<!-- src/views/Chat.vue -->
<template>
  <div class="chat-layout">
    <Sidebar
      :activePub="activePub"
      @openPrivate="handleOpenPrivate"
    />
    <Chatbox
      :targetUser="targetUser"
      @backToGroup="handleBackToGroup"
    />
    <!-- Toast notifikasi global -->
    <ToastContainer />
  </div>
</template>

<script setup>
import { ref, computed, provide, onMounted } from "vue";
import { getSession } from "../gun/auth.js";
import { requestNotificationPermission } from "../composables/useNotifications.js";
import Sidebar        from "../components/sidebar.vue";
import Chatbox        from "../components/chatbox.vue";
import ToastContainer from "../components/ToastContainer.vue";

const session     = getSession();
const currentUser = ref(session ?? { pub: "", alias: "Guest" });
provide("currentUser", currentUser);

// null  = tampilkan group chat
// { pub, alias } = private chat
const targetUser = ref(null);

// activePub: null = di group, string = pub user yang dichat secara private
const activePub = computed(() => targetUser.value?.pub ?? null);

const handleOpenPrivate = (user) => { targetUser.value = user; };
const handleBackToGroup = ()     => { targetUser.value = null; };

// Minta izin browser notification saat pertama masuk
onMounted(() => { requestNotificationPermission(); });
</script>

<style scoped>
.chat-layout {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #3b3b3b;
  position: fixed;
  top: 0;
  left: 0;
}
</style>