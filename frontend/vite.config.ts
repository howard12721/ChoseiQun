import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl = env.VITE_BACKEND_URL || "http://localhost:8080";
  const debugTraqUser = env.VITE_DEBUG_TRAQ_USER?.trim();

  return {
    appType: "spa",
    plugins: [react()],
    server: {
      port: 5173,
      watch: {
        usePolling: env.VITE_USE_POLLING === "true",
      },
      proxy: {
        "/api": {
          target: backendUrl,
          changeOrigin: true,
          headers: debugTraqUser
            ? {
                "X-Forwarded-User": debugTraqUser,
              }
            : undefined,
        },
      },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
