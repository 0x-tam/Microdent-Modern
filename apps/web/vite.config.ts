import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Local preview only — bind loopback (see master plan: avoid 0.0.0.0 in shipped patterns). */
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
});
