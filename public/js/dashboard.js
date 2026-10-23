(() => {
  "use strict";
  const fallbackAvatar = "https://cdn.discordapp.com/embed/avatars/0.png";
  const grid = document.getElementById("bots-grid");
  const emptyState = document.getElementById("empty-state");
  const menu = document.getElementById("user-dropdown");

  function text(tag, className, value) {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = value;
    return node;
  }

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

  function selectApp(id) {
    localStorage.setItem("bot_ativo_id", id);
    location.href = `/gerenciar?id=${encodeURIComponent(id)}`;
  }

  function appCard(app) {
    const expiresAt = new Date(app.datas?.expiraEm);
    const days = Number.isNaN(expiresAt.getTime())
      ? null
      : Math.ceil((expiresAt.getTime() - Date.now()) / 86400000);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "bot-card p-6 cursor-pointer group text-left w-full";
    card.addEventListener("click", () => selectApp(String(app.squareCloudId)));
    const top = document.createElement("div");
    top.className = "flex justify-between items-start mb-6";
    const identity = document.createElement("div");
    identity.className = "flex items-center gap-3";
    const avatar = document.createElement("img");
    avatar.src = safeImageUrl(app.identidade?.avatar);
    avatar.alt = "";
    avatar.className = "w-11 h-11 rounded-xl border border-zinc-800";
    const details = document.createElement("div");
    details.append(
      text(
        "h3",
        "font-bold text-white group-hover:text-[#2563eb] transition",
        app.identidade?.username || app.produto?.nome || "Aplicação",
      ),
      text(
        "p",
        "text-[10px] text-zinc-500 font-mono",
        `ID: ${String(app.squareCloudId).slice(0, 10)}`,
      ),
    );
    identity.append(avatar, details);
    const status = document.createElement("div");
    status.className = `w-2 h-2 rounded-full ${days !== null && days > 0 ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-red-500"}`;
    top.append(identity, status);
    const expiry = document.createElement("div");
    expiry.className =
      "text-xs text-zinc-500 py-3 border-t border-zinc-800 flex justify-between";
    expiry.append(
      text("span", "", "Expiração"),
      text(
        "span",
        "font-bold text-zinc-200",
        days === null ? "Não informada" : `${days} dias`,
      ),
    );
    card.append(
      top,
      expiry,
      text(
        "div",
        "mt-2 bg-zinc-900 border border-zinc-800 group-hover:bg-[#2563eb] group-hover:text-white group-hover:border-transparent transition-all py-2.5 rounded-lg text-center text-[10px] font-bold uppercase tracking-widest text-zinc-500",
        "Gerenciar aplicação",
      ),
    );
    return card;
  }

  async function load() {
    try {
      const sessionResponse = await fetch("/api/session", {
        cache: "no-store",
      });
      if (!sessionResponse.ok) {
        location.replace("/login?return=/dashboard");
        return;
      }
      const session = await sessionResponse.json();
      document.getElementById("user-name").textContent = session.user.username;
      document.getElementById("user-avatar").src = safeImageUrl(
        session.user.avatar,
      );
      const response = await fetch("/api/meus-bots", { cache: "no-store" });
      if (!response.ok)
        throw new Error("Não foi possível carregar suas aplicações.");
      const apps = await response.json();
      grid.replaceChildren(...apps.map(appCard));
      emptyState.classList.toggle("hidden", apps.length > 0);
    } catch (error) {
      console.error(error);
      emptyState.classList.remove("hidden");
    }
  }

  document
    .getElementById("user-profile-btn")
    .addEventListener("click", () => menu.classList.toggle("active"));
  document.getElementById("create-demo").addEventListener("click", async () => {
    try {
      const response = await fetch("/api/dev/demo-app", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.sucesso)
        throw new Error(data.erro || "Não foi possível criar a demonstração.");
      selectApp(data.bot.squareCloudId);
    } catch (error) {
      window.alert(error.message);
    }
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".auth-area")) menu.classList.remove("active");
  });
  load();
})();
