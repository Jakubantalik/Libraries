import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Multi-page static site: every top-level .html file is an entry.
export default defineConfig({
  plugins: [react()],
  server: {
    // Honour PORT so a busy 5173 reassigns cleanly — several sites in this
    // repo are often run side by side (matches the gooey site's config).
    port: Number(process.env.PORT) || 5173,
    strictPort: false
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        beam: resolve(__dirname, "beam.html"),
        orbs: resolve(__dirname, "orbs.html"),
        gooey: resolve(__dirname, "gooey.html"),
        metal: resolve(__dirname, "metal.html"),
        image: resolve(__dirname, "image.html"),
        pro: resolve(__dirname, "pro.html"),
        studio: resolve(__dirname, "studio.html"),
        "studio-app": resolve(__dirname, "studio/app.html"),
        account: resolve(__dirname, "account.html"),
        activate: resolve(__dirname, "activate.html"),
        success: resolve(__dirname, "success.html"),
        terms: resolve(__dirname, "terms.html"),
        privacy: resolve(__dirname, "privacy.html")
      }
    }
  }
});
