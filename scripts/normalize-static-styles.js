const fs = require("fs");
const path = require("path");

const publicDir = path.resolve(__dirname, "..", "public");
const logoStyle =
  /style="\s*width:\s*(22|25|30|35|45)px;\s*height:\s*\1px;\s*object-fit:\s*cover;\s*border-radius:\s*999px;\s*"/gi;

for (const fileName of fs
  .readdirSync(publicDir)
  .filter((name) => name.endsWith(".html"))) {
  const file = path.join(publicDir, fileName);
  let html = fs.readFileSync(file, "utf8");
  html = html.replace(
    logoStyle,
    (_match, size) => `class="brand-logo brand-logo--${size}"`,
  );
  html = html.replace(
    'style="font-family: monospace;" class="',
    'class="font-mono ',
  );
  if (!html.includes("/css/shared.css")) {
    html = html.replace(
      /<\/head>/i,
      '  <link rel="stylesheet" href="/css/shared.css">\n</head>',
    );
  }
  fs.writeFileSync(file, html, "utf8");
}

console.log("Estilos estáticos compartilhados normalizados.");
