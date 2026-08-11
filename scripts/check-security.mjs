import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const markup = await readFile(path.join(root, "index.html"), "utf8");
const startup = await readFile(path.join(root, "site-public/startup.js"), "utf8");
const sourceFiles = [
  "src/main.ts",
  "src/animal-glow.ts",
  "src/scene-placement.ts",
  "site-public/startup.js",
];
const source = (await Promise.all(sourceFiles.map((file) => readFile(path.join(root, file), "utf8")))).join("\n");
const failures = [];

const policy = markup.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/i)?.[1] ?? "";
for (const directive of [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "script-src 'self'",
  "script-src-attr 'none'",
  "worker-src 'none'",
  "require-trusted-types-for 'script'",
]) {
  if (!policy.includes(directive)) failures.push(`Content Security Policy is missing: ${directive}.`);
}

if (/script-src[^;]*'unsafe-inline'/.test(policy)) {
  failures.push("Executable inline JavaScript must remain blocked by the Content Security Policy.");
}

const executableInlineScripts = [...markup.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/gi)];
if (executableInlineScripts.length) failures.push("Executable JavaScript must be loaded from a same-origin file, never embedded inline.");

if (/<style\b/i.test(markup) || /\son[a-z]+\s*=/i.test(markup)) {
  failures.push("HTML cannot contain inline style blocks or inline event handlers.");
}

if (!/<script src="\/startup\.js"><\/script>/.test(markup) || !startup.includes("window.__ACTUAL_SCENE__")) {
  failures.push("The synchronous scene bootstrap must remain in the same-origin startup file.");
}

for (const dangerous of [
  /\.innerHTML\s*=/,
  /\.outerHTML\s*=/,
  /insertAdjacentHTML\s*\(/,
  /document\.write\s*\(/,
  /\beval\s*\(/,
  /new\s+Function\s*\(/,
]) {
  if (dangerous.test(source)) failures.push(`Unsafe DOM or code-execution primitive detected: ${dangerous}.`);
}

for (const match of markup.matchAll(/<a\b[^>]*target="_blank"[^>]*>/gi)) {
  if (!/rel="[^"]*(?:noopener|noreferrer)[^"]*"/i.test(match[0])) {
    failures.push("Links that open a new tab must prevent opener access.");
  }
}

if (failures.length) throw new Error(failures.join("\n"));
console.log("CSP blocks executable inline code, trusted DOM sinks stay unused, and external navigation is opener-safe.");
