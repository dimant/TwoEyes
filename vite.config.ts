import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Two Eyes",
        short_name: "Two Eyes",
        description: "Learn go from your first stone — beginner puzzles that work offline.",
        theme_color: "#166B74",
        background_color: "#FBF8F1",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      // Precache the whole app shell (the bank is bundled into the JS), so it runs fully offline.
      workbox: { globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"] },
    }),
  ],
  build: { outDir: "dist" },
});
