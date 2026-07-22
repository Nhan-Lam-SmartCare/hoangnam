import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import createStaffHandler from "./api/staff/create.js";
import updateStaffHandler from "./api/staff/update.js";
import deleteStaffHandler from "./api/staff/delete.js";

function localApiPlugin() {
  return {
    name: "local-api-plugin",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || "";
        const pathname = url.split("?")[0];

        if (req.method === "POST" && pathname === "/api/staff/create") {
          await createStaffHandler(req, res);
          return;
        }

        if (req.method === "POST" && pathname === "/api/staff/update") {
          await updateStaffHandler(req, res);
          return;
        }

        if (req.method === "POST" && pathname === "/api/staff/delete") {
          await deleteStaffHandler(req, res);
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  process.env.VITE_SUPABASE_URL =
    env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  process.env.VITE_SUPABASE_ANON_KEY =
    env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY =
    env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  return {
    server: { port: 4310, host: "0.0.0.0" },
    plugins: [react(), localApiPlugin()],
    test: {
      environment: "jsdom",
      globals: true,
      exclude: ["e2e/**", "node_modules/**"],
    },
    resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
    build: {
      rollupOptions: {
        input: path.resolve(process.cwd(), "index.html"),
        output: {
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash].[ext]",
        },
      },
    },
    define: {},
  };
});
