(() => {
  "use strict";
  const fallbackAvatar = "https://cdn.discordapp.com/embed/avatars/0.png";
  const container = document.getElementById("auth-container-placeholder");

  function safeImageUrl(value) {
    try {
      const url = new URL(value, location.origin);
      return ["http:", "https:"].includes(url.protocol)
        ? url.href
        : fallbackAvatar;
    } catch (_) {
      return fallbackAvatar;
    }
  }

  function revealSite() {
    const loader = document.getElementById("global-loader");
    setTimeout(() => {
      if (loader) loader.style.opacity = "0";
      setTimeout(() => {
        if (loader) loader.style.display = "none";
        document.body.classList.add("loaded");
      }, 300);
    }, 300);
  }

  function profileMenu(user) {
    const button = document.createElement("button");
    button.id = "user-profile-btn";
    button.className =
      "flex items-center gap-3 bg-[#0a0a0a] border border-white/10 pr-4 pl-1 py-1 rounded-full relative z-50 group";
    const avatar = document.createElement("img");
    avatar.src = safeImageUrl(user.avatar);
    avatar.alt = "";
    avatar.className = "w-9 h-9 rounded-full object-cover";
    const nameBox = document.createElement("div");
    nameBox.className = "text-left hidden sm:block";
    const name = document.createElement("p");
    name.className = "text-xs font-bold text-white leading-tight";
    name.textContent = user.username;
    nameBox.append(name);
    const chevron = document.createElement("i");
    chevron.className =
      "fa-solid fa-chevron-down text-[10px] text-zinc-600 group-hover:text-white ml-2 transition";
    button.append(avatar, nameBox, chevron);

    const menu = document.createElement("div");
    menu.id = "user-dropdown";
    menu.className =
      "dropdown-menu absolute right-0 mt-2 w-56 bg-[#09090b] border border-zinc-800 rounded-2xl shadow-xl p-2 z-50";
    const dashboard = document.createElement("a");
    dashboard.href = "/dashboard";
    dashboard.className =
      "flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900 rounded-lg transition";
    dashboard.textContent = "Aplicações";
    const logoutButton = document.createElement("button");
    logoutButton.className =
      "w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition text-left";
    logoutButton.textContent = "Sair";
    menu.append(dashboard, logoutButton);
    button.addEventListener("click", () => menu.classList.toggle("active"));
    container.replaceChildren(button, menu);
  }

  function fillProfile(user) {
    document.getElementById("profile-avatar").src = safeImageUrl(user.avatar);
    document.getElementById("profile-username").textContent = user.username;
    document.getElementById("profile-email").textContent =
      user.email || "Discord autenticado";
    document.getElementById("detail-email").textContent =
      user.email || "Não informado";
    document.getElementById("detail-discord-username").textContent =
      user.username;
    document.getElementById("detail-discord-id").textContent =
      user.discordId || user.id;
  }

  async function initialize() {
    try {
      const response = await fetch("/api/session", { cache: "no-store" });
      if (!response.ok) {
        location.replace("/login?return=/conta");
        return;
      }
      const { user } = await response.json();
      profileMenu(user);
      fillProfile(user);
      revealSite();
    } catch (_) {
      location.replace("/login?return=/conta");
    }
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#auth-container-placeholder"))
      document.getElementById("user-dropdown")?.classList.remove("active");
  });
  initialize();
})();
