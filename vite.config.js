import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png", "apple-touch-icon.png"],
      manifest: {
        name: "Stableford Tracker",
        short_name: "Stableford",
        description: "Live-synced Stableford round tracker with handicap allowance",
        theme_color: "#047857",
        background_color: "#ecfdf5",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Cache the app shell so it still loads with poor signal on the course.
        // Live score sync still needs a connection to Firestore.
        globPatterns: ["**/*.{js,css,html,png,svg}"],
      },
    }),
  ],
});
