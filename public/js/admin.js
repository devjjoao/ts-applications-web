(() => {
  "use strict";

  const content = document.getElementById("content");
  const metrics = document.getElementById("metrics");
  const tabs = document.getElementById("tabs");
  const toastElement = document.getElementById("toast");
  const money = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  let activeTab = "customers";
  let toastTimer;

  function escapeHtml(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
  }

  function formatDate(value, dateOnly = false) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return dateOnly
      ? date.toLocaleDateString("pt-BR")
      : date.toLocaleString("pt-BR");
  }

  async function api(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.erro || "Falha na operação.");
    return data;
  }

  function showToast(message, error = false) {
    clearTimeout(toastTimer);
    toastElement.textContent = message;
    toastElement.classList.toggle("text-red-400", error);
    toastElement.classList.remove("hidden");
    toastTimer = setTimeout(() => toastElement.classList.add("hidden"), 3000);
  }

  function table(headers, rows) {
    const body =
      rows ||
      '<tr><td colspan="9" class="text-zinc-500">Nenhum registro.</td></tr>';
    return `<div class="table-wrap"><table class="w-full"><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  async function loadOverview() {
    const { metrics: values } = await api("/api/admin/overview");
    const cards = [
      ["Clientes", values.customers, "users"],
      ["Aplicações", values.apps, "robot"],
      ["Online", values.runningApps, "circle-play"],
      ["Pendentes", values.pendingOrders, "clock"],
      ["Receita", money.format(Number(values.revenue || 0)), "wallet"],
      ["Não lidas", values.notifications, "bell"],
    ];
    metrics.innerHTML = cards
      .map(
        ([label, value, icon]) =>
          `<div class="card p-4"><i class="fa-solid fa-${icon} text-blue-500 mb-3"></i><p class="text-xl font-black">${escapeHtml(value)}</p><p class="text-[10px] uppercase tracking-wider text-zinc-500">${escapeHtml(label)}</p></div>`,
      )
      .join("");
  }

  async function renderCustomers() {
    const { customers } = await api("/api/admin/customers");
    const rows = customers
      .map((user) => {
        const search =
          `${user.username} ${user.email} ${user.id}`.toLowerCase();
        return `<tr data-search="${escapeHtml(search)}"><td><b>${escapeHtml(user.username)}</b><br><small class="text-zinc-500">${escapeHtml(user.email || "Sem e-mail")}</small></td><td class="font-mono text-xs">${escapeHtml(user.id)}</td><td>${formatDate(user.lastLoginAt)}</td><td>${Number(user.apps || 0)}</td><td>${Number(user.orders || 0)}</td></tr>`;
      })
      .join("");
    content.innerHTML = `<div class="p-4 border-b border-zinc-900"><input id="customer-search" class="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm" placeholder="Buscar nome, e-mail ou Discord ID"></div>${table(["Cliente", "Discord ID", "Último login", "Apps", "Pedidos"], rows)}`;
    document
      .getElementById("customer-search")
      .addEventListener("input", (event) => {
        const query = event.target.value.toLowerCase();
        content.querySelectorAll("[data-search]").forEach((row) => {
          row.hidden = !row.dataset.search.includes(query);
        });
      });
  }

  async function renderOrders() {
    const { orders } = await api("/api/admin/orders");
    const rows = orders
      .map((order) => {
        const id = String(order.id || order.faturaId);
        const status = String(order.statusPagamento || "pendente");
        const approveDisabled = status !== "pendente";
        const refundDisabled = status !== "aprovado";
        return `<tr><td class="font-mono text-xs">${escapeHtml(id)}</td><td class="font-mono text-xs">${escapeHtml(order.ownerId)}</td><td>${money.format(Number(order.preco ?? order.precoTotalPeriodo ?? 0))}</td><td><span class="pill">${escapeHtml(status)}</span></td><td>${formatDate(order.createdAt)}</td><td class="space-x-1"><button class="action" data-command="order" data-id="${escapeHtml(id)}" data-action="approve" ${approveDisabled ? "disabled" : ""}>Aprovar</button><button class="action" data-command="order" data-id="${escapeHtml(id)}" data-action="cancel" ${approveDisabled ? "disabled" : ""}>Cancelar</button><button class="action" data-command="order" data-id="${escapeHtml(id)}" data-action="refund" ${refundDisabled ? "disabled" : ""}>Reembolsar</button></td></tr>`;
      })
      .join("");
    content.innerHTML = table(
      ["Pedido", "Cliente", "Valor", "Status", "Criado em", "Ações"],
      rows,
    );
  }

  async function renderApps() {
    const { apps } = await api("/api/admin/apps");
    const rows = apps
      .map((app) => {
        const id = String(app.squareCloudId);
        const status = app.suspended
          ? "Suspensa"
          : app.running
            ? "Online"
            : "Offline";
        const toggleAction = app.suspended ? "activate" : "suspend";
        return `<tr><td><b>${escapeHtml(app.identidade?.username || app.produto?.nome)}</b><br><small class="font-mono text-zinc-500">${escapeHtml(id)}</small></td><td class="font-mono text-xs">${escapeHtml(app.ownerId)}</td><td><span class="pill">${status}</span></td><td>${formatDate(app.datas?.expiraEm, true)}</td><td class="space-x-1"><button class="action" data-command="app" data-id="${escapeHtml(id)}" data-action="${toggleAction}">${app.suspended ? "Ativar" : "Suspender"}</button><button class="action" data-command="app" data-id="${escapeHtml(id)}" data-action="extend">+30 dias</button></td></tr>`;
      })
      .join("");
    content.innerHTML = table(
      ["Aplicação", "Cliente", "Status", "Validade", "Ações"],
      rows,
    );
  }

  function renderNotifications() {
    content.innerHTML = `<form id="notification-form" class="p-6 max-w-xl space-y-4"><h2 class="font-bold text-xl">Enviar notificação</h2><label class="block text-xs text-zinc-500">Discord ID do cliente<input name="userId" inputmode="numeric" class="mt-2 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white" placeholder="Obrigatório no envio individual"></label><input name="title" maxlength="100" required class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3" placeholder="Título"><textarea name="message" maxlength="500" required class="w-full h-28 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3" placeholder="Mensagem"></textarea><label class="flex gap-2 text-sm"><input type="checkbox" name="broadcast"> Enviar para todos os clientes</label><button class="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl font-bold">Enviar</button></form>`;
    document
      .getElementById("notification-form")
      .addEventListener("submit", submitNotification);
  }

  async function renderIncidents() {
    const { incidents } = await api("/api/status");
    const history = incidents.length
      ? incidents
          .map(
            (incident) =>
              `<div class="border border-zinc-800 rounded-xl p-4 mb-3 flex justify-between gap-4"><div><b>${escapeHtml(incident.title)}</b><p class="text-xs text-zinc-500 mt-1">${escapeHtml(incident.message || "Sem detalhes")}</p></div>${incident.status !== "resolved" ? `<button class="action h-fit" data-command="resolve-incident" data-id="${escapeHtml(incident.id)}">Resolver</button>` : '<span class="text-xs text-emerald-400">Resolvido</span>'}</div>`,
          )
          .join("")
      : '<p class="text-sm text-zinc-500">Nenhum incidente registrado.</p>';
    content.innerHTML = `<form id="incident-form" class="p-6 max-w-xl space-y-4"><h2 class="font-bold text-xl">Publicar incidente</h2><input name="title" maxlength="120" required class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3" placeholder="Título do incidente"><textarea name="message" maxlength="500" class="w-full h-24 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3" placeholder="Atualização para os clientes"></textarea><select name="impact" class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3"><option value="minor">Impacto parcial</option><option value="major">Indisponibilidade geral</option></select><button class="bg-amber-600 hover:bg-amber-500 px-5 py-3 rounded-xl font-bold">Publicar</button></form><div class="border-t border-zinc-900 p-6"><h3 class="font-bold mb-4">Histórico</h3>${history}</div>`;
    document
      .getElementById("incident-form")
      .addEventListener("submit", submitIncident);
  }

  async function renderAudit() {
    const { logs } = await api("/api/admin/audit");
    const rows = logs
      .map(
        (log) =>
          `<tr><td>${formatDate(log.at)}</td><td>${escapeHtml(log.actorName)}<br><small class="font-mono text-zinc-600">${escapeHtml(log.actorId)}</small></td><td>${escapeHtml(log.action)}</td><td class="font-mono text-xs">${escapeHtml(log.target || "—")}</td><td class="font-mono text-xs">${escapeHtml(log.ip || "—")}</td></tr>`,
      )
      .join("");
    content.innerHTML = table(
      ["Data", "Responsável", "Ação", "Alvo", "IP"],
      rows,
    );
  }

  async function loadTab() {
    content.innerHTML = '<div class="p-8 text-zinc-500">Carregando...</div>';
    try {
      const renderers = {
        customers: renderCustomers,
        orders: renderOrders,
        apps: renderApps,
        notifications: renderNotifications,
        incidents: renderIncidents,
        audit: renderAudit,
      };
      await renderers[activeTab]();
    } catch (error) {
      content.innerHTML = `<div class="p-8 text-red-400">${escapeHtml(error.message)}</div>`;
    }
  }

  async function submitNotification(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      await api("/api/admin/notifications", {
        method: "POST",
        body: JSON.stringify({
          userId: values.get("userId"),
          title: values.get("title"),
          message: values.get("message"),
          broadcast: values.get("broadcast") === "on",
        }),
      });
      form.reset();
      showToast("Notificação enviada.");
      await loadOverview();
    } catch (error) {
      showToast(error.message, true);
    }
  }

  async function submitIncident(event) {
    event.preventDefault();
    try {
      await api("/api/admin/incidents", {
        method: "POST",
        body: JSON.stringify(
          Object.fromEntries(new FormData(event.currentTarget)),
        ),
      });
      showToast("Incidente publicado.");
      await Promise.all([loadTab(), loadOverview()]);
    } catch (error) {
      showToast(error.message, true);
    }
  }

  async function handleCommand(button) {
    const { command, id, action } = button.dataset;
    if (
      command !== "resolve-incident" &&
      !window.confirm("Confirmar esta ação?")
    )
      return;
    button.disabled = true;
    try {
      if (command === "order")
        await api(`/api/admin/orders/${encodeURIComponent(id)}/action`, {
          method: "POST",
          body: JSON.stringify({ action }),
        });
      if (command === "app")
        await api(`/api/admin/apps/${encodeURIComponent(id)}/action`, {
          method: "POST",
          body: JSON.stringify({ action, days: 30 }),
        });
      if (command === "resolve-incident")
        await api(`/api/admin/incidents/${encodeURIComponent(id)}/resolve`, {
          method: "POST",
          body: "{}",
        });
      showToast("Operação concluída.");
      await Promise.all([loadTab(), loadOverview()]);
    } catch (error) {
      button.disabled = false;
      showToast(error.message, true);
    }
  }

  tabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tab]");
    if (!button) return;
    tabs
      .querySelectorAll(".tab")
      .forEach((tab) => tab.classList.remove("active"));
    button.classList.add("active");
    activeTab = button.dataset.tab;
    loadTab();
  });
  content.addEventListener("click", (event) => {
    const button = event.target.closest("[data-command]");
    if (button) handleCommand(button);
  });
  Promise.all([loadOverview(), loadTab()]).catch((error) => {
    content.innerHTML = `<div class="p-8 text-red-400">${escapeHtml(error.message)}</div>`;
  });
})();
