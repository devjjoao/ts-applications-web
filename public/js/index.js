(() => {
  "use strict";
  const fallbackAvatar = "https://cdn.discordapp.com/embed/avatars/0.png";

  function safeUrl(value, fallback = "#") {
    try {
      const url = new URL(value, location.origin);
      return ["http:", "https:"].includes(url.protocol) ? url.href : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function formatNumber(value) {
    const number = Number(value || 0);
    return number >= 1000 ? `${(number / 1000).toFixed(1)}k` : String(number);
  }

  function serverCard(server) {
    const card = document.createElement("a");
    card.href = safeUrl(server.convite);
    card.target = "_blank";
    card.rel = "noopener noreferrer";
    card.className = "client-card";
    card.style.setProperty(
      "--bg-img",
      `url("${safeUrl(server.icone, fallbackAvatar).replace(/["\\]/g, "")}")`,
    );
    const icon = document.createElement("img");
    icon.src = safeUrl(server.icone, fallbackAvatar);
    icon.alt = "";
    icon.className = "server-icon";
    icon.addEventListener(
      "error",
      () => {
        icon.src = fallbackAvatar;
      },
      { once: true },
    );
    const content = document.createElement("div");
    content.className = "card-content text-left";
    const title = document.createElement("span");
    title.className = "card-title";
    title.textContent = server.nome || "Comunidade";
    const stats = document.createElement("div");
    stats.className = "card-stats";
    for (const value of [
      `${formatNumber(server.membros)} membros`,
      `${formatNumber(server.online)} online`,
    ]) {
      const item = document.createElement("div");
      item.className = "stat-item";
      const dot = document.createElement("span");
      dot.className = "dot";
      item.append(dot, value);
      stats.append(item);
    }
    content.append(title, stats);
    const discord = document.createElement("i");
    discord.className = "fa-brands fa-discord discord-icon";
    card.append(icon, content, discord);
    return card;
  }

  async function loadServers() {
    try {
      const response = await fetch("/api/servidores/lista", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const servers = await response.json();
      document
        .getElementById("servidores-track")
        .replaceChildren(
          ...[...servers, ...servers, ...servers].map(serverCard),
        );
    } catch (error) {
      console.error(error);
    }
  }

  function renderLogin() {
    const link = document.createElement("a");
    link.href = "/login";
    link.className =
      "bg-white text-black px-6 py-2 rounded-xl font-bold text-sm hover:bg-zinc-200 transition";
    link.textContent = "Entrar";
    document.getElementById("auth-area").replaceChildren(link);
  }

  function renderUser(user) {
    const area = document.getElementById("auth-area");
    const button = document.createElement("button");
    button.className =
      "flex items-center gap-3 bg-[#0a0a0a] border border-white/10 pr-4 pl-1 py-1 rounded-full relative z-50";
    const avatar = document.createElement("img");
    avatar.src = safeUrl(user.avatar, fallbackAvatar);
    avatar.alt = "";
    avatar.className = "w-9 h-9 rounded-full object-cover";
    const nameBox = document.createElement("div");
    nameBox.className = "text-left hidden sm:block";
    const name = document.createElement("p");
    name.className = "text-xs font-bold text-white leading-tight";
    name.textContent = user.username;
    nameBox.append(name);
    const chevron = document.createElement("i");
    chevron.className = "fa-solid fa-chevron-down text-xs text-zinc-600 ml-2";
    button.append(avatar, nameBox, chevron);
    const menu = document.createElement("div");
    menu.id = "user-menu";
    menu.className =
      "dropdown-menu absolute right-0 mt-2 w-56 bg-[#09090b] border border-zinc-800 rounded-2xl shadow-xl p-2 z-50 text-left";
    const dashboard = document.createElement("a");
    dashboard.href = "/dashboard";
    dashboard.className =
      "block px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900 rounded-lg transition";
    dashboard.textContent = "Minhas aplicações";
    const account = document.createElement("a");
    account.href = "/conta";
    account.className = dashboard.className;
    account.textContent = "Minha conta";
    const logoutButton = document.createElement("button");
    logoutButton.className =
      "w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg text-left";
    logoutButton.textContent = "Sair";
    menu.append(dashboard, account, logoutButton);
    button.addEventListener("click", () => menu.classList.toggle("active"));
    area.replaceChildren(button, menu);
  }

  async function loadSession() {
    try {
      const response = await fetch("/api/session", { cache: "no-store" });
      if (!response.ok) return renderLogin();
      const data = await response.json();
      renderUser(data.user);
    } catch (_) {
      renderLogin();
    }
  }

  function startSnow() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = document.getElementById("snowCanvas");
    const context = canvas.getContext("2d");
    let width;
    let height;
    let flakes = [];
    function resize() {
      width = innerWidth;
      height = innerHeight;
      canvas.width = width;
      canvas.height = height;
      flakes = Array.from({ length: 150 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 2 + 1,
        speed: Math.random() + 0.5,
        opacity: Math.random() * 0.5 + 0.3,
      }));
    }
    function animate() {
      context.clearRect(0, 0, width, height);
      context.fillStyle = "white";
      for (const flake of flakes) {
        context.beginPath();
        context.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
        context.globalAlpha = flake.opacity;
        context.fill();
        flake.y += flake.speed;
        flake.x += Math.sin(flake.y / 50) * 0.5;
        if (flake.y > height) {
          flake.y = -10;
          flake.x = Math.random() * width;
        }
      }
      requestAnimationFrame(animate);
    }
    addEventListener("resize", resize);
    resize();
    animate();
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#auth-area"))
      document.getElementById("user-menu")?.classList.remove("active");
  });
  loadServers();
  loadSession();
  startSnow();
  document.body.classList.add("loaded");
})();
