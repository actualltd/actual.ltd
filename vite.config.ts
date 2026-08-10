import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  publicDir: "site-public",
  build: {
    emptyOutDir: true,
    outDir: "dist",
  },
});
