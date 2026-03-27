import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const useStubs = env.VITE_USE_STUBS === "true";
  const backendUrl = env.VITE_BACKEND_URL || "http://localhost:8080";

  return {
    appType: "spa",
    plugins: [react()],
    server: {
      port: 5173,
      proxy: useStubs
        ? undefined
        : {
            "/api": {
              target: backendUrl,
              changeOrigin: true,
            },
          },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
