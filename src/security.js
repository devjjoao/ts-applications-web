const crypto = require("crypto");

function secret() {
  return (
    process.env.DATA_ENCRYPTION_KEY ||
    process.env.SESSION_SECRET ||
    process.env.API_KEY ||
    "development-only-change-this-secret"
  );
}

function key() {
  return crypto.createHash("sha256").update(secret()).digest();
}

function encrypt(value) {
  const text = String(value || "");
  if (!text) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

function decrypt(value) {
  const text = String(value || "");
  if (!text.startsWith("enc:v1:")) return text;
  const [, , iv, tag, payload] = text.split(":");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(payload, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function redact(details = {}) {
  const safe = {};
  for (const [name, value] of Object.entries(details)) {
    safe[name] = /token|secret|password|authorization/i.test(name)
      ? "[oculto]"
      : value;
  }
  return safe;
}

module.exports = { decrypt, encrypt, redact };
