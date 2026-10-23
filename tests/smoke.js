const assert = require("assert/strict");
const crypto = require("crypto");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const port = 3199;
const sessionSecret = "test-session-secret-with-more-than-32-characters";
const adminId = "1335231684693721128";

function sessionCookie(sessionId) {
  const signature = crypto
    .createHmac("sha256", sessionSecret)
    .update(sessionId)
    .digest("base64url");
  return `ts_session=${sessionId}.${signature}`;
}

async function request(route, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, options);
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function waitForServer(server) {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Servidor de teste não iniciou.")),
      10000,
    );
    server.stdout.on("data", (chunk) => {
      if (String(chunk).includes("online em")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    server.once("exit", (code) =>
      reject(new Error(`Servidor encerrou com código ${code}.`)),
    );
  });
}

async function run() {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "ts-applications-test-"),
  );
  const stateFile = path.join(tempDir, "platform.json");
  const sessionId = crypto.randomBytes(24).toString("hex");
  const state = {
    apps: {
      "app-test": {
        squareCloudId: "app-test",
        ownerId: adminId,
        running: false,
        datas: { expiraEm: "2026-12-01T00:00:00.000Z" },
        produto: { id: "bot-vendas-01", nome: "Ts Pro" },
        identidade: { username: "Aplicação de teste", avatar: null },
      },
    },
    carts: {
      "cart-test": {
        id: "cart-test",
        ownerId: adminId,
        produtoId: "bot-vendas-01",
        plano: "mensal",
        preco: 6.99,
        createdAt: new Date().toISOString(),
        statusPagamento: "pendente",
      },
    },
    payments: {},
    renewals: {},
    sessions: {
      [sessionId]: {
        user: {
          id: adminId,
          username: "Admin de teste",
          email: "test@example.com",
        },
        expiresAt: Date.now() + 60000,
      },
    },
    notifications: {},
    auditLogs: [],
    incidents: [],
    statusChecks: [],
    users: {},
  };
  await fs.writeFile(stateFile, JSON.stringify(state));

  const server = spawn(process.execPath, ["src/server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      PORT: String(port),
      PUBLIC_URL: `http://localhost:${port}`,
      PLATFORM_DATA_FILE: stateFile,
      SESSION_SECRET: sessionSecret,
      DATA_ENCRYPTION_KEY: "test-encryption-key-with-more-than-32-characters",
      NODE_ENV: "development",
      TRUST_PROXY: "false",
      DISCORD_CLIENT_ID: "test-client",
      DISCORD_CLIENT_SECRET: "test-secret",
      ADMIN_DISCORD_IDS: adminId,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForServer(server);
    const headers = {
      Cookie: sessionCookie(sessionId),
      "Content-Type": "application/json",
    };

    let result = await request("/api/status");
    assert.equal(result.response.status, 200);

    result = await request("/api/admin/overview", { headers });
    assert.equal(result.response.status, 200);
    assert.equal(result.data.metrics.apps, 1);

    result = await request("/api/renovacao/carrinho", {
      method: "POST",
      headers,
      body: JSON.stringify({
        idAppSquarecloud: "app-test",
        planoEscolhido: "mensal",
        meses: 99,
        precoTotalPeriodo: 0.01,
      }),
    });
    assert.equal(result.response.status, 201);
    const invoiceId = result.data.faturaId;

    result = await request(
      `/api/renovacao/fatura/${encodeURIComponent(invoiceId)}`,
      { headers },
    );
    assert.equal(result.response.status, 200);
    assert.equal(result.data.fatura.precoTotalPeriodo, 6.99);
    assert.equal(result.data.fatura.meses, 1);

    result = await request("/api/renovacao/aplicar-desconto", {
      method: "POST",
      headers,
      body: JSON.stringify({ faturaId: invoiceId, cupomCodigo: "TS10" }),
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.data.novoPreco, 3.5);

    result = await request("/api/renovacao/aplicar-desconto", {
      method: "POST",
      headers,
      body: JSON.stringify({ faturaId: invoiceId, cupomCodigo: "TS10" }),
    });
    assert.equal(result.response.status, 409);

    result = await request("/api/carrinho/aplicar-desconto", {
      method: "POST",
      headers,
      body: JSON.stringify({ cupomCodigo: "TS10" }),
    });
    assert.equal(result.response.status, 200);
    result = await request("/api/carrinho/aplicar-desconto", {
      method: "POST",
      headers,
      body: JSON.stringify({ cupomCodigo: "TS10" }),
    });
    assert.equal(result.response.status, 409);

    result = await request("/api/admin/orders/cart-test/action", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "approve" }),
    });
    assert.equal(result.response.status, 200);
    result = await request("/api/admin/orders/cart-test/action", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "approve" }),
    });
    assert.equal(result.response.status, 409);

    result = await request("/api/notifications/read", {
      method: "POST",
      headers: { ...headers, Origin: "https://evil.example" },
      body: "{}",
    });
    assert.equal(result.response.status, 403);
    console.log("Smoke tests: OK");
  } finally {
    server.kill();
    await new Promise((resolve) => server.once("exit", resolve));
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
