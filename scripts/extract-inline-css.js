const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const cssDir = path.join(publicDir, "css");

fs.mkdirSync(cssDir, { recursive: true });

let extracted = 0;
for (const fileName of fs
  .readdirSync(publicDir)
  .filter((name) => name.endsWith(".html"))) {
  const htmlPath = path.join(publicDir, fileName);
  const html = fs.readFileSync(htmlPath, "utf8");
  const blocks = [
    ...html.matchAll(/^[ \t]*<style[^>]*>([\s\S]*?)^[ \t]*<\/style>\s*$/gim),
  ];
  if (!blocks.length) continue;

  const pageName = path.basename(fileName, ".html");
  const cssPath = path.join(cssDir, `${pageName}.css`);
  const css = blocks.map((match) => match[1].trim()).join("\n\n");
  fs.writeFileSync(cssPath, `${css}\n`, "utf8");

  let linked = false;
  const updatedHtml = html.replace(
    /^[ \t]*<style[^>]*>[\s\S]*?^[ \t]*<\/style>\s*$/gim,
    () => {
      if (linked) return "";
      linked = true;
      return `  <link rel="stylesheet" href="/css/${pageName}.css">`;
    },
  );
  fs.writeFileSync(htmlPath, updatedHtml, "utf8");
  extracted += 1;
  console.log(`${fileName} -> public/css/${pageName}.css`);
}

console.log(`${extracted} página(s) processada(s).`);
