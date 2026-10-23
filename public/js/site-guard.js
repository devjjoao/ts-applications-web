(() => {
  const protectedPages = ["/dashboard", "/gerenciar", "/conta", "/admin"];
  const escapeHtml = (value) =>
    String(value ?? "").replace(
      /[&<>'"]/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[char],
    );

  async function logout() {
    try {
      await fetch("/api/session/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch (_) {}
    localStorage.removeItem("zyper_user");
    localStorage.removeItem("bot_ativo_id");
    location.href = "/";
  }
  window.logout = logout;

  function notificationUI(admin) {
    const style = document.createElement("style");
    style.textContent = `.ts-notify{position:fixed;right:22px;bottom:22px;z-index:9998;font-family:Inter,system-ui,sans-serif}.ts-notify button{border:1px solid #27272a;background:#09090b;color:#fff;width:50px;height:50px;border-radius:16px;cursor:pointer;box-shadow:0 12px 35px #0008}.ts-notify-badge{position:absolute;right:-5px;top:-5px;min-width:20px;height:20px;padding:0 5px;border-radius:20px;background:#2563eb;color:white;font:700 11px/20px sans-serif;text-align:center}.ts-notify-panel{display:none;position:absolute;right:0;bottom:60px;width:min(380px,calc(100vw - 32px));max-height:480px;overflow:auto;background:#09090b;border:1px solid #27272a;border-radius:18px;box-shadow:0 25px 70px #000c;color:#fff}.ts-notify.open .ts-notify-panel{display:block}.ts-notify-head{position:sticky;top:0;background:#09090bf2;padding:16px;border-bottom:1px solid #27272a;display:flex;justify-content:space-between;align-items:center}.ts-notify-item{padding:14px 16px;border-bottom:1px solid #18181b}.ts-notify-item.unread{background:#2563eb10}.ts-notify-item strong{display:block;font-size:13px}.ts-notify-item p{margin:5px 0;color:#a1a1aa;font-size:12px;line-height:1.45}.ts-notify-item time{color:#52525b;font-size:10px}.ts-admin-link{color:#60a5fa;font-size:12px;text-decoration:none}`;
    document.head.appendChild(style);
    const root = document.createElement("div");
    root.className = "ts-notify";
    root.innerHTML = `<button type="button" aria-label="Notificações">🔔</button><span class="ts-notify-badge" hidden>0</span><div class="ts-notify-panel"><div class="ts-notify-head"><strong>Notificações</strong><span>${admin ? '<a class="ts-admin-link" href="/admin">Administração</a>' : ""}</span></div><div class="ts-notify-list"><div class="ts-notify-item"><p>Carregando…</p></div></div></div>`;
    document.body.appendChild(root);
    root.querySelector("button").onclick = async () => {
      root.classList.toggle("open");
      if (root.classList.contains("open")) {
        await fetch("/api/notifications/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        root.querySelector(".ts-notify-badge").hidden = true;
      }
    };
    document.addEventListener("click", (event) => {
      if (!root.contains(event.target)) root.classList.remove("open");
    });
    return root;
  }

  async function loadNotifications(root) {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      const badge = root.querySelector(".ts-notify-badge");
      const list = root.querySelector(".ts-notify-list");
      badge.textContent = data.unread > 99 ? "99+" : data.unread;
      badge.hidden = !data.unread;
      list.innerHTML = data.notifications.length
        ? data.notifications
            .map(
              (item) =>
                `<div class="ts-notify-item ${item.read ? "" : "unread"}"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message)}</p><time>${new Date(item.createdAt).toLocaleString("pt-BR")}</time></div>`,
            )
            .join("")
        : '<div class="ts-notify-item"><p>Nenhuma notificação por enquanto.</p></div>';
    } catch (_) {}
  }

  async function initialize() {
    try {
      const response = await fetch("/api/session", { cache: "no-store" });
      if (!response.ok) throw new Error("unauthorized");
      const data = await response.json();
      localStorage.setItem("zyper_user", JSON.stringify(data.user));
      const root = notificationUI(Boolean(data.admin));
      await loadNotifications(root);
      setInterval(() => loadNotifications(root), 60000);
      if (location.pathname === "/admin" && !data.admin)
        location.replace("/dashboard");
    } catch (_) {
      localStorage.removeItem("zyper_user");
      if (protectedPages.includes(location.pathname))
        location.replace(
          `/login?return=${encodeURIComponent(location.pathname)}`,
        );
    }
  }

  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest("button");
      if (button && /^\s*Sair\s*$/i.test(button.textContent || "")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        logout();
      }
    },
    true,
  );
  initialize();
})();
