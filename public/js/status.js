(() => {
  "use strict";
  const labels = {
    operational: [
      "Todos os sistemas operacionais",
      "Os serviços estão respondendo normalmente.",
    ],
    degraded: [
      "Desempenho parcialmente afetado",
      "Um ou mais componentes precisam de atenção.",
    ],
    major_outage: [
      "Indisponibilidade em andamento",
      "Nossa equipe está acompanhando o incidente.",
    ],
  };

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderComponents(components, fallbackLatency) {
    const container = document.getElementById("components");
    container.replaceChildren(
      ...components.map((component) => {
        const card = element(
          "div",
          "card p-5 flex justify-between items-center",
        );
        const text = element("div");
        text.append(
          element("b", "", component.name),
          element(
            "p",
            "text-xs text-zinc-600 mt-1",
            `Resposta em ${component.latency ?? fallbackLatency}ms`,
          ),
        );
        const operational = component.status === "operational";
        const badge = element(
          "span",
          `text-[10px] uppercase font-black px-3 py-1 rounded-full ${operational ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`,
          operational ? "Operacional" : "Atenção",
        );
        card.append(text, badge);
        return card;
      }),
    );
  }

  function renderIncidents(incidents) {
    const container = document.getElementById("incidents");
    if (!incidents.length) {
      container.replaceChildren(
        element(
          "div",
          "card p-6 text-zinc-500 text-sm",
          "Nenhum incidente registrado.",
        ),
      );
      return;
    }
    container.replaceChildren(
      ...incidents.map((incident) => {
        const article = element("article", "card p-5");
        const heading = element("div", "flex justify-between gap-3");
        heading.append(
          element("b", "", incident.title),
          element(
            "span",
            `text-xs ${incident.status === "resolved" ? "text-emerald-400" : "text-amber-400"}`,
            incident.status === "resolved" ? "Resolvido" : "Em análise",
          ),
        );
        article.append(
          heading,
          element(
            "p",
            "text-sm text-zinc-500 mt-2",
            incident.message || "Atualização em andamento.",
          ),
          element(
            "time",
            "block text-[10px] text-zinc-700 mt-3",
            new Date(incident.createdAt).toLocaleString("pt-BR"),
          ),
        );
        return article;
      }),
    );
  }

  async function update() {
    try {
      const started = performance.now();
      const response = await fetch("/api/status", { cache: "no-store" });
      if (!response.ok) throw new Error("Status indisponível");
      const data = await response.json();
      const latency = Math.round(performance.now() - started);
      const label = labels[data.overall] || labels.degraded;
      const summary = document.getElementById("summary");
      summary.className = `card p-7 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5 ${data.overall}`;
      summary.querySelector("h1").textContent = label[0];
      summary.querySelector("p.text-sm").textContent = label[1];
      document.getElementById("checked").textContent = new Date(
        data.checkedAt,
      ).toLocaleString("pt-BR");
      document.getElementById("uptime").textContent = `${data.uptime24h}%`;
      document.getElementById("latency").textContent = `${latency}ms`;
      renderComponents(data.components, latency);
      renderIncidents(data.incidents);
    } catch (_) {
      const summary = document.getElementById("summary");
      summary.classList.add("major_outage");
      summary.querySelector("h1").textContent =
        "Não foi possível consultar o status";
      summary.querySelector("p.text-sm").textContent =
        "Tente novamente em alguns instantes.";
    }
  }
  update();
  setInterval(update, 60000);
})();
