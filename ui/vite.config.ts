import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const daemonURL = env.VITE_DAEMON_URL || "http://127.0.0.1:9480";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: daemonURL,
          changeOrigin: false,
          rewrite: (path) => path.replace(/^\/api/, "")
        }
      }
    }
  };
});
