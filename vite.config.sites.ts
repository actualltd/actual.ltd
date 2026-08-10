import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig, type Plugin } from "vite";

function sitesMetadata(): Plugin {
  return {
    name: "sites-metadata",
    apply: "build",
    async closeBundle() {
      const outputDirectory = resolve("dist", ".openai");
      await rm(outputDirectory, { recursive: true, force: true });
      await mkdir(outputDirectory, { recursive: true });
      await cp(resolve(".openai", "hosting.json"), resolve(outputDirectory, "hosting.json"));
    },
  };
}

export default defineConfig({
  base: "/",
  publicDir: "site-public",
  plugins: [
    sitesMetadata(),
    cloudflare({
      viteEnvironment: { name: "server" },
    }),
  ],
});
