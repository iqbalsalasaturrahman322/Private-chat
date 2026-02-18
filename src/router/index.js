// src/router/index.js

import { createRouter, createWebHistory } from "vue-router";
import { getSession } from "../gun/auth.js";
import Login from "../views/Login.vue";
import Chat  from "../views/Chat.vue";

const routes = [
  {
    path: "/login",
    name: "Login",
    component: Login,
    meta: { requiresGuest: true },
  },
  {
    path: "/",
    name: "Chat",
    component: Chat,
    meta: { requiresAuth: true },
  },
  // redirect semua route tidak dikenal ke "/"
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Navigation guard
router.beforeEach((to) => {
  const loggedIn = !!getSession();

  if (to.meta.requiresAuth && !loggedIn) {
    return { name: "Login" };
  }
  if (to.meta.requiresGuest && loggedIn) {
    return { name: "Chat" };
  }
});

export default router;