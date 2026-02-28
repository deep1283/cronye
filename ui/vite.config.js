import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, process.cwd(), "");
    var daemonURL = env.VITE_DAEMON_URL || "http://127.0.0.1:9480";
    return {
        plugins: [react()],
        server: {
            port: 5173,
            proxy: {
                "/api": {
                    target: daemonURL,
                    changeOrigin: false,
                    rewrite: function (path) { return path.replace(/^\/api/, ""); }
                }
            }
        }
    };
});
