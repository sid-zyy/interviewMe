import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json" with { type: "json" };

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    rollupOptions: {
      input: {
        permission: "src/permission/index.html",
      },
    },
  },
  server: {
    // required for the extension dev server to talk to the CRXJS HMR client
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
});
