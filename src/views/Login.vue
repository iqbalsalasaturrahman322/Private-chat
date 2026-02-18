<!-- src/views/Login.vue -->
<template>
  <div class="login-page">
    <div class="login-card">
      <!-- Logo / judul -->
      <div class="brand">
        <div class="brand-icon">💬</div>
        <h1>Private Chat</h1>
        <p>Masuk untuk mulai mengobrol</p>
      </div>

      <!-- Form -->
      <div class="form">
        <div class="field">
          <label>Username</label>
          <input
            v-model="alias"
            type="text"
            placeholder="Masukkan username"
            autocomplete="username"
            @keyup.enter="handleSubmit"
          />
        </div>

        <div class="field">
          <label>Password</label>
          <input
            v-model="password"
            type="password"
            placeholder="Masukkan password"
            autocomplete="current-password"
            @keyup.enter="handleSubmit"
          />
        </div>

        <div v-if="errorMsg" class="error-msg">⚠ {{ errorMsg }}</div>

        <button class="btn-primary" :disabled="loading" @click="handleSubmit">
          <span v-if="loading" class="spinner"></span>
          {{ loading ? "Memproses..." : isRegister ? "Daftar" : "Login" }}
        </button>

        <button class="btn-link" @click="isRegister = !isRegister">
          {{ isRegister ? "Sudah punya akun? Login" : "Belum punya akun? Daftar" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { login, register } from "../gun/auth.js";

const router     = useRouter();
const alias      = ref("");
const password   = ref("");
const errorMsg   = ref("");
const loading    = ref(false);
const isRegister = ref(false);

const handleSubmit = async () => {
  errorMsg.value = "";

  if (!alias.value.trim()) {
    errorMsg.value = "Username tidak boleh kosong.";
    return;
  }
  if (password.value.length < 4) {
    errorMsg.value = "Password minimal 4 karakter.";
    return;
  }

  loading.value = true;
  try {
    if (isRegister.value) {
      await register(alias.value, password.value);
    } else {
      await login(alias.value, password.value);
    }
    router.push("/");
  } catch (err) {
    errorMsg.value = err.message || "Terjadi kesalahan.";
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-page {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #3b3b3b;
  padding: 16px;
}

.login-card {
  background: #4a4a4a;
  border: 1px solid #5a5a5a;
  border-radius: 10px;
  padding: 36px 30px;
  width: 100%;
  max-width: 340px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.5);
}

/* Brand */
.brand {
  text-align: center;
  margin-bottom: 28px;
}

.brand-icon {
  font-size: 36px;
  margin-bottom: 8px;
}

.brand h1 {
  font-size: 22px;
  color: #fff;
  margin-bottom: 4px;
}

.brand p {
  font-size: 13px;
  color: #aaa;
}

/* Form */
.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 14px;
}

.field label {
  font-size: 12px;
  color: #ccc;
  font-weight: bold;
  letter-spacing: 0.3px;
}

.field input {
  padding: 9px 11px;
  border-radius: 5px;
  border: 1px solid #666;
  background: #f2f2f2;
  color: #222;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.field input:focus {
  border-color: #e74c3c;
  box-shadow: 0 0 0 2px rgba(231, 76, 60, 0.2);
}

.error-msg {
  color: #e74c3c;
  font-size: 12px;
  margin-bottom: 10px;
  padding: 8px 10px;
  background: rgba(231, 76, 60, 0.12);
  border-radius: 4px;
  border-left: 3px solid #e74c3c;
}

.btn-primary {
  width: 100%;
  padding: 10px;
  background: #e74c3c;
  color: #fff;
  border: none;
  border-radius: 5px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background 0.15s;
  margin-bottom: 10px;
}

.btn-primary:hover:not(:disabled) { background: #c0392b; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-link {
  width: 100%;
  background: none;
  border: none;
  color: #aaa;
  font-size: 12px;
  cursor: pointer;
  text-align: center;
  text-decoration: underline;
  transition: color 0.15s;
}

.btn-link:hover { color: #fff; }

/* Spinner */
.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>