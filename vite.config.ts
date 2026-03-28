import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    server: { port: 4310, host: "0.0.0.0" },
    plugins: [react()],
    test: {
      exclude: ["e2e/**", "node_modules/**"],
    },
    resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
    build: {
      // Cache-busting: thêm hash vào tên file để trình duyệt luôn tải bản mới nhất
      rollupOptions: {
        input: path.resolve(process.cwd(), "index.html"),
        output: {
          // Thêm content hash vào tên file - khi code thay đổi, hash thay đổi
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash].[ext]",
        },
      },
    },
    // Note: API keys should be handled server-side, not exposed in client bundle
    // If Gemini API is needed, create a backend proxy endpoint
    define: {},
  };
});
