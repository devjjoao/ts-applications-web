const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const refactoredPages = [
  "admin.html",
  "conta.html",
  "dashboard.html",
  "faq.html",
  "index.html",
  "status.html",
];

const allPages = fs
  .readdirSync(path.join(root, "public"))
  .filter((file) => file.endsWith(".html"));

for (const file of allPages) {
  const html = fs.readFileSync(path.join(root, "public", file), "utf8");
  assert.equal(
    /<style\b/i.test(html),
    false,
    `${file} ainda possui bloco <style>.`,
  );
  assert.equal(
    /\sstyle\s*=/i.test(html),
    false,
    `${file} ainda possui atributo style inline.`,
  );
  const pageCss = path.join(
    root,
    "public",
    "css",
    file.replace(/\.html$/, ".css"),
  );
  assert.equal(
    fs.existsSync(pageCss),
    true,
    `${file} não possui seu arquivo CSS externo.`,
  );
}

for (const file of refactoredPages) {
  const html = fs.readFileSync(path.join(root, "public", file), "utf8");
  const inlineScripts = [
    ...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi),
  ].filter((match) => match[1].trim());
  assert.equal(
    inlineScripts.length,
    0,
    `${file} ainda possui JavaScript inline.`,
  );
  assert.equal(
    /\sonclick\s*=/i.test(html),
    false,
    `${file} ainda possui onclick inline.`,
  );
  for (const match of html.matchAll(/<script[^>]+src=["'](\/[^"']+)["']/gi)) {
    const localFile = path.join(root, "public", match[1].replace(/^\//, ""));
    assert.equal(
      fs.existsSync(localFile),
      true,
      `${file} referencia ${match[1]}, mas o arquivo não existe.`,
    );
  }
}

console.log("Static checks: OK");
