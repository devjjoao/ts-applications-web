const crypto = require("crypto");
const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const { mutateState, readState } = require("./json-store");
const { encrypt, redact } = require("./security");

const database = path.resolve(__dirname, "..", "database");
async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (_) {
    return fallback;
  }
}
function owner(req) {
  return req.user?.id || null;
}
function requireSession(req, res, next) {
  if (!owner(req))
    return res
      .status(401)
      .json({ sucesso: false, erro: "Sessão expirada. Entre novamente." });
  return next();
}
async function adminIds() {
  const fileIds = await readJson(path.join(database, "admins.json"), []);
  const envIds = String(process.env.ADMIN_DISCORD_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set([...fileIds.map(String), ...envIds]);
}
async function requireAdmin(req, res, next) {
  if (!owner(req))
    return res.status(401).json({ sucesso: false, erro: "Sessão expirada." });
  if (!(await adminIds()).has(String(owner(req))))
    return res
      .status(403)
      .json({ sucesso: false, erro: "Acesso restrito a administradores." });
  req.isAdmin = true;
  return next();
}
function publicApp(app) {
  const { token, ...safe } = app;
  return {
    ...safe,
    hasToken: Boolean(token),
    tokenStatus: token ? "definido" : "pendente",
  };
}
function appForOwner(state, id, userId) {
  const app = state.apps[id];
  return app && app.ownerId === userId ? app : null;
}
function maskedIp(value) {
  const ip = String(value || "").replace(/^::ffff:/, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip))
    return `${ip.split(".").slice(0, 3).join(".")}.x`;
  return ip.includes(":")
    ? `${ip.split(":").slice(0, 4).join(":")}::`
    : ip.slice(0, 12);
}
function addAudit(state, req, action, target = null, details = {}) {
  state.auditLogs.push({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    actorId: owner(req) || "system",
    actorName: req.user?.username || "Sistema",
    action,
    target,
    ip: maskedIp(req.ip || req.socket?.remoteAddress),
    details: redact(details),
  });
  state.auditLogs = state.auditLogs.slice(-2000);
}
function notify(
  state,
  userId,
  title,
  message,
  type = "info",
  link = null,
  dedupeKey = null,
) {
  state.notifications[userId] ||= [];
  if (
    dedupeKey &&
    state.notifications[userId].some((item) => item.dedupeKey === dedupeKey)
  )
    return;
  state.notifications[userId].unshift({
    id: crypto.randomUUID(),
    title,
    message,
    type,
    link,
    dedupeKey,
    read: false,
    createdAt: new Date().toISOString(),
  });
  state.notifications[userId] = state.notifications[userId].slice(0, 100);
}
function orders(state) {
  return [...Object.values(state.carts), ...Object.values(state.renewals)];
}
function orderAmount(order) {
  return Number(order.preco ?? order.precoTotalPeriodo ?? 0);
}
function validCoupon(coupon) {
  if (!coupon || coupon.ativo === false) return false;
  if (coupon.expiraEm && new Date(coupon.expiraEm).getTime() < Date.now())
    return false;
  return true;
}
function renewalPlan(plan) {
  return { mensal: 1, trimestral: 3, anual: 12 }[plan] || null;
}
function customerIds(state) {
  return [
    ...new Set(
      [
        ...Object.keys(state.users),
        ...Object.values(state.apps).map((item) => item.ownerId),
        ...orders(state).map((item) => item.ownerId),
      ].filter(Boolean),
    ),
  ];
}
function ensureAutomatedNotifications(state, userId) {
  const now = Date.now();
  for (const app of Object.values(state.apps).filter(
    (item) => item.ownerId === userId && item.datas?.expiraEm,
  )) {
    const expiry = new Date(app.datas.expiraEm);
    const days = Math.ceil((expiry.getTime() - now) / 86400000);
    if (days <= 7) {
      const name = app.identidade?.username || app.produto?.nome || "Aplicação";
      const label =
        days < 0
          ? "expirou"
          : days === 0
            ? "vence hoje"
            : `vence em ${days} dia${days === 1 ? "" : "s"}`;
      notify(
        state,
        userId,
        "Renovação próxima",
        `${name} ${label}. Acesse o painel para renovar.`,
        days < 0 ? "warning" : "info",
        "/dashboard",
        `expiry:${app.squareCloudId}:${expiry.toISOString().slice(0, 10)}:${Math.max(days, -1)}`,
      );
    }
  }
}
function serviceSnapshot(state) {
  const secretOk = Boolean(
    process.env.SESSION_SECRET &&
    !/troque|development/i.test(process.env.SESSION_SECRET),
  );
  const discordOk = Boolean(
    process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET,
  );
  const components = [
    { id: "site", name: "Portal e API", status: "operational", latency: null },
    {
      id: "database",
      name: "Banco de dados JSON",
      status: "operational",
      latency: null,
    },
    {
      id: "discord",
      name: "Login Discord",
      status: discordOk ? "operational" : "degraded",
      latency: null,
    },
    {
      id: "security",
      name: "Gateway de segurança",
      status: secretOk ? "operational" : "degraded",
      latency: null,
    },
  ];
  const activeIncidents = state.incidents.filter(
    (item) => item.status !== "resolved",
  );
  const overall = activeIncidents.some((item) => item.impact === "major")
    ? "major_outage"
    : activeIncidents.length ||
        components.some((item) => item.status !== "operational")
      ? "degraded"
      : "operational";
  const recent = state.statusChecks.filter(
    (item) => Date.now() - new Date(item.at).getTime() <= 86400000,
  );
  return {
    overall,
    components,
    activeIncidents,
    uptime24h: recent.length
      ? Number(
          (
            (recent.filter((item) => item.ok).length / recent.length) *
            100
          ).toFixed(2),
        )
      : 100,
  };
}

function createPlatformRouter() {
  const router = express.Router();
  router.get("/api/produtos", async (_req, res) =>
    res.json(await readJson(path.join(database, "products.json"), [])),
  );
  router.get("/api/servidores/lista", async (_req, res) =>
    res.json(await readJson(path.join(database, "servidores.json"), [])),
  );
  router.get("/api/status", async (_req, res) => {
    const started = Date.now();
    const state = await readState();
    const snapshot = serviceSnapshot(state);
    snapshot.components.forEach((item) => {
      item.latency = Date.now() - started;
    });
    res.json({
      sucesso: true,
      checkedAt: new Date().toISOString(),
      ...snapshot,
      incidents: state.incidents.slice(-20).reverse(),
    });
    mutateState((current) => {
      current.statusChecks.push({
        at: new Date().toISOString(),
        ok: snapshot.overall !== "major_outage",
        latency: Date.now() - started,
      });
      current.statusChecks = current.statusChecks
        .filter((item) => Date.now() - new Date(item.at).getTime() <= 604800000)
        .slice(-10080);
    }).catch(() => {});
  });
  router.get("/api/meus-bots", requireSession, async (req, res) => {
    const state = await readState();
    res.json(
      Object.values(state.apps)
        .filter((app) => app.ownerId === owner(req))
        .map(publicApp),
    );
  });
  router.post("/api/dev/demo-app", requireSession, async (req, res) => {
    if (process.env.NODE_ENV === "production")
      return res
        .status(403)
        .json({ sucesso: false, erro: "Demonstração bloqueada em produção." });
    const result = await mutateState((state) => {
      const existing = Object.values(state.apps).find(
        (app) => app.ownerId === owner(req) && app.demo,
      );
      if (existing) return { app: existing, existing: true };
      const id = `demo-${crypto.randomUUID()}`;
      const expires = new Date();
      expires.setDate(expires.getDate() + 30);
      const app = {
        squareCloudId: id,
        ownerId: owner(req),
        demo: true,
        running: false,
        startedAt: null,
        createdAt: new Date().toISOString(),
        datas: { expiraEm: expires.toISOString() },
        produto: { id: "demo", nome: "Ts Applications — Demonstração" },
        identidade: {
          id: "",
          username: "Minha aplicação de teste",
          avatar: req.user.avatar || null,
        },
      };
      state.apps[id] = app;
      addAudit(state, req, "demo_app.created", id);
      return { app, existing: false };
    });
    return res.status(result.existing ? 200 : 201).json({
      sucesso: true,
      bot: publicApp(result.app),
      existente: result.existing,
    });
  });
  router.get("/api/bot/detalhes/:id", requireSession, async (req, res) => {
    const app = appForOwner(await readState(), req.params.id, owner(req));
    if (!app)
      return res
        .status(404)
        .json({ sucesso: false, erro: "Aplicação não encontrada." });
    return res.json({ sucesso: true, bot: publicApp(app) });
  });
  router.get("/api/square/status/:id", requireSession, async (req, res) => {
    const app = appForOwner(await readState(), req.params.id, owner(req));
    if (!app)
      return res
        .status(404)
        .json({ sucesso: false, erro: "Aplicação não encontrada." });
    return res.json({
      sucesso: true,
      status: {
        running: Boolean(app.running),
        suspended: Boolean(app.suspended),
        starting: false,
        needsConfig: !app.token || !app.serverId,
        uptime: app.startedAt ? Date.now() - app.startedAt : 0,
      },
    });
  });
  router.post("/api/square/token", requireSession, async (req, res) => {
    const { squareId, newToken, serverId } = req.body || {};
    const token = String(newToken || "").trim();
    const guildId = String(serverId || "").trim();
    if (!token || !guildId)
      return res.status(400).json({
        sucesso: false,
        erro: "Token e ID do servidor são obrigatórios.",
      });
    if (token.length < 20 || token.length > 300)
      return res
        .status(400)
        .json({ sucesso: false, erro: "Formato de token inválido." });
    if (!/^\d{15,22}$/.test(guildId))
      return res.status(400).json({
        sucesso: false,
        erro: "O ID do servidor Discord é inválido.",
      });
    const app = await mutateState((state) => {
      const item = appForOwner(state, squareId, owner(req));
      if (!item) return null;
      item.token = encrypt(token);
      item.serverId = guildId;
      item.updatedAt = new Date().toISOString();
      addAudit(state, req, "app.credentials_updated", squareId, {
        serverId: guildId,
      });
      return item;
    });
    if (!app)
      return res
        .status(404)
        .json({ sucesso: false, erro: "Aplicação não encontrada." });
    return res.json({ sucesso: true, appId: app.squareCloudId });
  });
  router.post("/api/square/action", requireSession, async (req, res) => {
    const { squareId, action } = req.body || {};
    if (!["start", "stop", "restart"].includes(action))
      return res.status(400).json({ sucesso: false, erro: "Ação inválida." });
    const result = await mutateState((state) => {
      const app = appForOwner(state, squareId, owner(req));
      if (!app) return { missing: true };
      if (app.suspended) return { suspended: true };
      if (
        ["start", "restart"].includes(action) &&
        (!app.token || !app.serverId)
      )
        return { needsConfig: true };
      app.running = action !== "stop";
      app.startedAt = app.running ? Date.now() : null;
      app.updatedAt = new Date().toISOString();
      addAudit(state, req, `app.${action}`, squareId);
      return { app };
    });
    if (result.missing)
      return res
        .status(404)
        .json({ sucesso: false, erro: "Aplicação não encontrada." });
    if (result.suspended)
      return res.status(403).json({
        sucesso: false,
        erro: "Aplicação suspensa. Fale com a administração.",
      });
    if (result.needsConfig)
      return res.status(409).json({
        sucesso: false,
        needsConfig: true,
        erro: "Configure o token e o servidor antes de iniciar.",
      });
    return res.json({ sucesso: true, status: publicApp(result.app) });
  });
  router.post("/api/carrinho", requireSession, async (req, res) => {
    const { produtoId, plano = "mensal" } = req.body || {};
    const products = await readJson(path.join(database, "products.json"), []);
    const product = products.find(
      (item) => item.id === produtoId && !item.desenvolvimento,
    );
    if (!product || !product.precos?.[plano])
      return res
        .status(400)
        .json({ sucesso: false, erro: "Produto ou plano inválido." });
    const id = crypto.randomUUID();
    await mutateState((state) => {
      state.carts[id] = {
        id,
        ownerId: owner(req),
        produtoId,
        plano,
        preco: Number(product.precos[plano]),
        createdAt: new Date().toISOString(),
        status: "aguardando_pagamento",
        statusPagamento: "pendente",
      };
      addAudit(state, req, "cart.created", id, { produtoId, plano });
    });
    return res.status(201).json({ sucesso: true, sessaoId: id });
  });
  router.get("/api/carrinho/:id", requireSession, async (req, res) => {
    const state = await readState();
    const cart = state.carts[req.params.id];
    if (!cart || cart.ownerId !== owner(req))
      return res
        .status(404)
        .json({ sucesso: false, erro: "Carrinho não encontrado." });
    const products = await readJson(path.join(database, "products.json"), []);
    return res.json({
      sucesso: true,
      carrinho: cart,
      produto: products.find((item) => item.id === cart.produtoId) || null,
    });
  });
  router.post(
    "/api/carrinho/aplicar-desconto",
    requireSession,
    async (req, res) => {
      const code = String(req.body?.cupomCodigo || "")
        .trim()
        .toUpperCase();
      const coupons = [
        ...(await readJson(path.join(database, "cupons.json"), [])),
        ...(await readJson(path.join(database, "cupom.json"), [])),
      ];
      const coupon = coupons.find(
        (item) =>
          String(item.codigo || "").toUpperCase() === code && validCoupon(item),
      );
      if (!coupon)
        return res
          .status(404)
          .json({ sucesso: false, erro: "Cupom inválido ou expirado." });
      const percentage = Number(coupon.porcentagem || coupon.desconto || 0);
      if (!(percentage > 0 && percentage <= 100))
        return res
          .status(400)
          .json({ sucesso: false, erro: "Cupom sem desconto configurado." });
      const result = await mutateState((state) => {
        const item = Object.values(state.carts)
          .filter(
            (value) =>
              value.ownerId === owner(req) &&
              value.statusPagamento === "pendente",
          )
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        if (!item) return { error: "not_found" };
        if (item.cupom) return { error: "already_applied" };
        item.precoOriginal = item.preco;
        item.preco = Number((item.preco * (1 - percentage / 100)).toFixed(2));
        item.cupom = code;
        item.descontoPorcentagem = percentage;
        addAudit(state, req, "cart.coupon_applied", item.id, {
          code,
          percentage,
        });
        return { cart: item };
      });
      if (result.error === "not_found")
        return res.status(404).json({
          sucesso: false,
          erro: "Nenhum carrinho pendente encontrado.",
        });
      if (result.error === "already_applied")
        return res.status(409).json({
          sucesso: false,
          erro: "Este carrinho já possui um cupom aplicado.",
        });
      return res.json({
        sucesso: true,
        novoPreco: result.cart.preco,
        porcentagem: percentage,
      });
    },
  );
  router.post("/api/pagamento/pix", requireSession, (_req, res) =>
    res.status(501).json({
      sucesso: false,
      erro: "Gateway PIX não configurado. Consulte a documentação para conectar seu provedor.",
    }),
  );
  router.get("/api/pagamento/status/:id", requireSession, async (req, res) => {
    const cart = (await readState()).carts[req.params.id];
    return res.json({
      sucesso: Boolean(cart && cart.ownerId === owner(req)),
      pago: Boolean(cart?.statusPagamento === "aprovado"),
    });
  });
  router.get(
    "/api/bot/renovacao-data/:id",
    requireSession,
    async (req, res) => {
      const app = appForOwner(await readState(), req.params.id, owner(req));
      if (!app)
        return res
          .status(404)
          .json({ sucesso: false, erro: "Aplicação não encontrada." });
      const products = await readJson(path.join(database, "products.json"), []);
      const product = products.find((item) => item.id === app.produto?.id);
      if (!product?.precos)
        return res.status(409).json({
          sucesso: false,
          erro: "Esta aplicação não possui preços de renovação configurados.",
        });
      return res.json({
        sucesso: true,
        botData: {
          nome: app.identidade?.username || app.produto?.nome || "Aplicação",
          produtoNome: product.nome || app.produto?.nome || "Serviço",
          avatarUrl: app.identidade?.avatar,
          donoId: app.ownerId,
          donoEmail: req.user.email,
          precos: product.precos,
          expiraEm: app.datas?.expiraEm || null,
        },
      });
    },
  );
  router.post("/api/renovacao/carrinho", requireSession, async (req, res) => {
    const { idAppSquarecloud, planoEscolhido } = req.body || {};
    const meses = renewalPlan(planoEscolhido);
    if (!meses)
      return res
        .status(400)
        .json({ sucesso: false, erro: "Plano de renovação inválido." });
    const products = await readJson(path.join(database, "products.json"), []);
    const faturaId = `RENOV-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
    const result = await mutateState((state) => {
      const app = appForOwner(state, idAppSquarecloud, owner(req));
      if (!app) return { error: "not_found" };
      const product = products.find((item) => item.id === app.produto?.id);
      const preco = Number(product?.precos?.[planoEscolhido]);
      if (!Number.isFinite(preco) || preco <= 0) return { error: "price" };
      const base = new Date(
        Math.max(Date.now(), new Date(app.datas?.expiraEm || 0).getTime() || 0),
      );
      base.setMonth(base.getMonth() + meses);
      state.renewals[faturaId] = {
        faturaId,
        ownerId: owner(req),
        idAppSquarecloud,
        nomeDoBot: app.identidade?.username || app.produto?.nome,
        botAvatarUrl: app.identidade?.avatar || null,
        planoEscolhido,
        meses,
        precoMensalBase: Number(product.precos.mensal || preco),
        precoTotalPeriodo: preco,
        dataExpiracao: base.toISOString(),
        statusPagamento: "pendente",
        createdAt: new Date().toISOString(),
      };
      addAudit(state, req, "renewal.created", faturaId, {
        idAppSquarecloud,
        planoEscolhido,
        meses,
      });
      return { ok: true };
    });
    if (result.error === "not_found")
      return res
        .status(404)
        .json({ sucesso: false, erro: "Aplicação não encontrada." });
    if (result.error === "price")
      return res.status(409).json({
        sucesso: false,
        erro: "Preço de renovação não configurado para este produto.",
      });
    return res.status(201).json({ sucesso: true, faturaId });
  });
  router.get("/api/renovacao/fatura/:id", requireSession, async (req, res) => {
    const invoice = (await readState()).renewals[req.params.id];
    if (!invoice || invoice.ownerId !== owner(req))
      return res
        .status(404)
        .json({ sucesso: false, erro: "Fatura não encontrada." });
    return res.json({ sucesso: true, fatura: invoice });
  });
  router.post(
    "/api/renovacao/aplicar-desconto",
    requireSession,
    async (req, res) => {
      const faturaId = String(req.body?.faturaId || "");
      const code = String(req.body?.cupomCodigo || "")
        .trim()
        .toUpperCase();
      const coupons = [
        ...(await readJson(path.join(database, "cupons.json"), [])),
        ...(await readJson(path.join(database, "cupom.json"), [])),
      ];
      const coupon = coupons.find(
        (item) =>
          String(item.codigo || "").toUpperCase() === code && validCoupon(item),
      );
      if (!coupon)
        return res
          .status(404)
          .json({ sucesso: false, erro: "Cupom inválido ou expirado." });
      const percentage = Number(coupon.porcentagem || coupon.desconto || 0);
      if (!(percentage > 0 && percentage <= 100))
        return res
          .status(400)
          .json({ sucesso: false, erro: "Cupom sem desconto configurado." });
      const result = await mutateState((state) => {
        const invoice = state.renewals[faturaId];
        if (!invoice || invoice.ownerId !== owner(req))
          return { error: "not_found" };
        if (invoice.statusPagamento !== "pendente") return { error: "closed" };
        if (invoice.cupom) return { error: "already_applied" };
        invoice.precoOriginal = invoice.precoTotalPeriodo;
        invoice.precoTotalPeriodo = Number(
          (invoice.precoTotalPeriodo * (1 - percentage / 100)).toFixed(2),
        );
        invoice.cupom = code;
        invoice.descontoPorcentagem = percentage;
        invoice.updatedAt = new Date().toISOString();
        addAudit(state, req, "renewal.coupon_applied", faturaId, {
          code,
          percentage,
        });
        return { invoice };
      });
      if (result.error === "not_found")
        return res
          .status(404)
          .json({ sucesso: false, erro: "Fatura não encontrada." });
      if (result.error === "closed")
        return res
          .status(409)
          .json({ sucesso: false, erro: "Esta fatura não aceita alterações." });
      if (result.error === "already_applied")
        return res.status(409).json({
          sucesso: false,
          erro: "Esta fatura já possui um cupom aplicado.",
        });
      return res.json({
        sucesso: true,
        novoPreco: result.invoice.precoTotalPeriodo,
        porcentagem: percentage,
        cupom: code,
      });
    },
  );
  router.post("/api/renovacao/pagamento/pix", requireSession, (_req, res) =>
    res.status(501).json({
      sucesso: false,
      erro: "Gateway PIX não configurado. Consulte a documentação para conectar seu provedor.",
    }),
  );
  router.get(
    "/api/renovacao/pagamento/status/:id",
    requireSession,
    async (req, res) => {
      const invoice = (await readState()).renewals[req.params.id];
      return res.json({
        sucesso: Boolean(invoice && invoice.ownerId === owner(req)),
        pago: Boolean(invoice?.statusPagamento === "aprovado"),
      });
    },
  );

  router.get("/api/notifications", requireSession, async (req, res) => {
    const items = await mutateState((state) => {
      ensureAutomatedNotifications(state, owner(req));
      return state.notifications[owner(req)] || [];
    });
    res.json({
      sucesso: true,
      unread: items.filter((item) => !item.read).length,
      notifications: items,
    });
  });
  router.post("/api/notifications/read", requireSession, async (req, res) => {
    await mutateState((state) => {
      for (const item of state.notifications[owner(req)] || [])
        if (!req.body?.id || item.id === req.body.id) item.read = true;
    });
    res.json({ sucesso: true });
  });

  router.get("/api/admin/me", requireAdmin, (_req, res) =>
    res.json({ sucesso: true, admin: true }),
  );
  router.get("/api/admin/overview", requireAdmin, async (_req, res) => {
    const state = await readState();
    const allOrders = orders(state);
    const approved = allOrders.filter(
      (item) => item.statusPagamento === "aprovado",
    );
    res.json({
      sucesso: true,
      metrics: {
        customers: customerIds(state).length,
        apps: Object.keys(state.apps).length,
        runningApps: Object.values(state.apps).filter((app) => app.running)
          .length,
        pendingOrders: allOrders.filter(
          (item) => item.statusPagamento === "pendente",
        ).length,
        revenue: approved.reduce((sum, item) => sum + orderAmount(item), 0),
        notifications: Object.values(state.notifications)
          .flat()
          .filter((item) => !item.read).length,
      },
      status: serviceSnapshot(state),
    });
  });
  router.get("/api/admin/customers", requireAdmin, async (req, res) => {
    const state = await readState();
    const query = String(req.query.q || "").toLowerCase();
    const customers = customerIds(state)
      .map(
        (id) =>
          state.users[id] || {
            id,
            username: "Cliente sem login recente",
            email: "",
          },
      )
      .filter(
        (user) =>
          !query ||
          `${user.username} ${user.email} ${user.id}`
            .toLowerCase()
            .includes(query),
      )
      .map((user) => ({
        ...user,
        apps: Object.values(state.apps).filter((app) => app.ownerId === user.id)
          .length,
        orders: orders(state).filter((item) => item.ownerId === user.id).length,
      }));
    res.json({ sucesso: true, customers });
  });
  router.get("/api/admin/apps", requireAdmin, async (_req, res) =>
    res.json({
      sucesso: true,
      apps: Object.values((await readState()).apps).map(publicApp),
    }),
  );
  router.get("/api/admin/orders", requireAdmin, async (_req, res) =>
    res.json({ sucesso: true, orders: orders(await readState()) }),
  );
  router.get("/api/admin/audit", requireAdmin, async (_req, res) =>
    res.json({
      sucesso: true,
      logs: (await readState()).auditLogs.slice(-300).reverse(),
    }),
  );
  router.post("/api/admin/apps/:id/action", requireAdmin, async (req, res) => {
    const action = String(req.body?.action || "");
    if (!["suspend", "activate", "extend"].includes(action))
      return res.status(400).json({ sucesso: false, erro: "Ação inválida." });
    const requestedDays = Number(req.body?.days ?? 30);
    if (
      action === "extend" &&
      (!Number.isInteger(requestedDays) ||
        requestedDays < 1 ||
        requestedDays > 365)
    )
      return res.status(400).json({
        sucesso: false,
        erro: "A prorrogação deve ser um número inteiro entre 1 e 365 dias.",
      });
    const result = await mutateState((state) => {
      const app = state.apps[req.params.id];
      if (!app) return null;
      if (action === "suspend") {
        app.suspended = true;
        app.running = false;
        app.startedAt = null;
      }
      if (action === "activate") app.suspended = false;
      if (action === "extend") {
        const currentExpiry = new Date(app.datas?.expiraEm || 0).getTime();
        const date = new Date(Math.max(Date.now(), currentExpiry || 0));
        date.setDate(date.getDate() + requestedDays);
        app.datas ||= {};
        app.datas.expiraEm = date.toISOString();
      }
      app.updatedAt = new Date().toISOString();
      addAudit(state, req, `admin.app.${action}`, req.params.id, {
        days: action === "extend" ? requestedDays : undefined,
      });
      notify(
        state,
        app.ownerId,
        "Sua aplicação foi atualizada",
        action === "suspend"
          ? "A aplicação foi suspensa pela administração."
          : action === "activate"
            ? "A aplicação foi reativada."
            : `A validade foi prorrogada em ${requestedDays} dias.`,
        action === "suspend" ? "warning" : "success",
        "/dashboard",
      );
      return app;
    });
    if (!result)
      return res
        .status(404)
        .json({ sucesso: false, erro: "Aplicação não encontrada." });
    return res.json({ sucesso: true, app: publicApp(result) });
  });
  router.post(
    "/api/admin/orders/:id/action",
    requireAdmin,
    async (req, res) => {
      const action = String(req.body?.action || "");
      if (!["approve", "cancel", "refund"].includes(action))
        return res.status(400).json({ sucesso: false, erro: "Ação inválida." });
      const allowedFrom = {
        approve: ["pendente"],
        cancel: ["pendente"],
        refund: ["aprovado"],
      };
      const result = await mutateState((state) => {
        const order =
          state.carts[req.params.id] || state.renewals[req.params.id];
        if (!order) return { error: "not_found" };
        if (!allowedFrom[action].includes(order.statusPagamento))
          return { error: "transition", current: order.statusPagamento };
        order.statusPagamento =
          action === "approve"
            ? "aprovado"
            : action === "refund"
              ? "reembolsado"
              : "cancelado";
        order.updatedAt = new Date().toISOString();
        addAudit(state, req, `admin.order.${action}`, req.params.id, {
          reason: String(req.body?.reason || "").slice(0, 300),
        });
        notify(
          state,
          order.ownerId,
          "Status do pedido atualizado",
          `O pedido ${req.params.id} agora está ${order.statusPagamento}.`,
          action === "approve" ? "success" : "warning",
        );
        return { order };
      });
      if (result.error === "not_found")
        return res
          .status(404)
          .json({ sucesso: false, erro: "Pedido não encontrado." });
      if (result.error === "transition")
        return res.status(409).json({
          sucesso: false,
          erro: `Ação incompatível com o estado atual: ${result.current}.`,
        });
      return res.json({ sucesso: true, order: result.order });
    },
  );
  router.post("/api/admin/notifications", requireAdmin, async (req, res) => {
    const title = String(req.body?.title || "").trim();
    const message = String(req.body?.message || "").trim();
    const userId = String(req.body?.userId || "").trim();
    if (!title || !message)
      return res
        .status(400)
        .json({ sucesso: false, erro: "Título e mensagem são obrigatórios." });
    if (!req.body.broadcast && !/^\d{15,22}$/.test(userId))
      return res.status(400).json({
        sucesso: false,
        erro: "Informe um ID Discord válido ou selecione o envio geral.",
      });
    await mutateState((state) => {
      const targets = req.body.broadcast ? customerIds(state) : [userId];
      for (const target of targets)
        notify(
          state,
          target,
          title.slice(0, 100),
          message.slice(0, 500),
          ["info", "success", "warning"].includes(req.body.type)
            ? req.body.type
            : "info",
          req.body.link || null,
        );
      addAudit(
        state,
        req,
        "admin.notification.sent",
        req.body.broadcast ? "broadcast" : userId,
        { title, total: targets.length },
      );
    });
    return res.status(201).json({ sucesso: true });
  });
  router.post("/api/admin/incidents", requireAdmin, async (req, res) => {
    const title = String(req.body?.title || "").trim();
    if (!title)
      return res
        .status(400)
        .json({ sucesso: false, erro: "Título obrigatório." });
    const incident = await mutateState((state) => {
      const item = {
        id: crypto.randomUUID(),
        title: title.slice(0, 120),
        message: String(req.body?.message || "").slice(0, 500),
        impact: ["minor", "major"].includes(req.body?.impact)
          ? req.body.impact
          : "minor",
        status: "investigating",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      state.incidents.push(item);
      addAudit(state, req, "admin.incident.created", item.id, {
        title,
        impact: item.impact,
      });
      return item;
    });
    res.status(201).json({ sucesso: true, incident });
  });
  router.post(
    "/api/admin/incidents/:id/resolve",
    requireAdmin,
    async (req, res) => {
      const incident = await mutateState((state) => {
        const item = state.incidents.find(
          (value) => value.id === req.params.id,
        );
        if (!item) return null;
        item.status = "resolved";
        item.resolvedAt = new Date().toISOString();
        item.updatedAt = item.resolvedAt;
        addAudit(state, req, "admin.incident.resolved", item.id);
        return item;
      });
      if (!incident)
        return res
          .status(404)
          .json({ sucesso: false, erro: "Incidente não encontrado." });
      res.json({ sucesso: true, incident });
    },
  );
  return router;
}
module.exports = { createPlatformRouter };
