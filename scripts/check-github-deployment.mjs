import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const workflow = await readFile(path.join(root, ".github/workflows/pages.yml"), "utf8");
const cname = (await readFile(path.join(root, "site-public/CNAME"), "utf8")).trim();
const vite = await readFile(path.join(root, "vite.config.ts"), "utf8");
const failures = [];

if (cname !== "actual.ltd") failures.push("GitHub Pages CNAME must be actual.ltd.");
if (!/actions\/deploy-pages@/.test(workflow) || !/path:\s*dist/.test(workflow)) {
  failures.push("GitHub Pages must deploy the Vite dist directory through the official Pages action.");
}
if (!/publicDir:\s*["']site-public["']/.test(vite)) failures.push("Vite must publish site-public through the GitHub Pages build.");
if (packageJson.scripts?.["build:sites"] || packageJson.devDependencies?.wrangler || packageJson.devDependencies?.["@cloudflare/vite-plugin"]) {
  failures.push("Cloudflare build scripts and dependencies must not remain in the GitHub-only project.");
}

for (const file of ["wrangler.jsonc", "vite.config.sites.ts", ".openai/hosting.json", "site-public/_headers", "worker/index.ts"]) {
  try {
    await access(path.join(root, file));
    failures.push(`Cloudflare/Sites file still exists: ${file}`);
  } catch {}
}

if (failures.length) throw new Error(failures.join("\n"));
console.log("GitHub Pages is the only deployment path and actual.ltd is configured as its custom domain.");
