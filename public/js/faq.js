(() => {
  "use strict";
  const items = [
    [
      "Como funciona a entrega?",
      "Após a confirmação do pagamento, a aplicação aparece na sua dashboard. Você configura o token do bot e o ID do servidor seguindo o passo a passo.",
    ],
    [
      "Onde encontro o token do bot?",
      "No Discord Developer Portal, abra sua aplicação, acesse a área Bot e gere o token. Nunca envie esse token para outras pessoas.",
    ],
    [
      "Como adiciono o bot ao servidor?",
      "Na tela de gerenciamento da aplicação, use o botão Adicionar bot ao servidor e escolha um servidor em que você tenha permissão de administrador.",
    ],
    [
      "Como acompanho o funcionamento?",
      "A dashboard mostra o estado de cada aplicação. A página Status apresenta a disponibilidade do portal, banco JSON, login Discord e incidentes publicados.",
    ],
    [
      "Como funcionam as renovações?",
      "Você pode iniciar a renovação pelo painel da aplicação. A nova validade é aplicada quando o pagamento for aprovado.",
    ],
    [
      "Meus dados estão seguros?",
      "As sessões são assinadas e persistidas no banco JSON, tokens novos são criptografados e ações sensíveis ficam registradas na auditoria.",
    ],
    [
      "O que acontece se minha aplicação for suspensa?",
      "Ela não poderá ser iniciada até a reativação. Você receberá uma notificação no site explicando a alteração.",
    ],
    [
      "Como recebo avisos?",
      "Depois de entrar, use o sino no canto inferior direito para consultar alterações, vencimentos e comunicados.",
    ],
    [
      "Existe sistema de tickets?",
      "Ainda não. Para suporte individual, utilize o servidor oficial no Discord.",
    ],
  ];
  const list = document.getElementById("list");
  const empty = document.getElementById("empty");
  const search = document.getElementById("search");

  function render(query = "") {
    const filtered = items.filter((item) =>
      item.join(" ").toLowerCase().includes(query.toLowerCase()),
    );
    list.replaceChildren(
      ...filtered.map(([question, answer]) => {
        const details = document.createElement("details");
        details.className = "faq p-5";
        const summary = document.createElement("summary");
        summary.className = "font-bold flex justify-between gap-4";
        summary.append(question);
        const icon = document.createElement("span");
        icon.className = "text-blue-500";
        icon.textContent = "+";
        summary.append(icon);
        const paragraph = document.createElement("p");
        paragraph.className = "text-zinc-400 text-sm leading-7 pt-4";
        paragraph.textContent = answer;
        details.append(summary, paragraph);
        return details;
      }),
    );
    empty.classList.toggle("hidden", filtered.length > 0);
  }
  search.addEventListener("input", (event) => render(event.target.value));
  render();
})();
