import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/main",
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/preload",
    },
  },
  renderer: {
    root: resolve(__dirname, "../renderer"),
    envDir: resolve(__dirname, "../.."),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": resolve(__dirname, "../renderer/src"),
      },
    },
    server: {
      port: 5173,
      strictPort: false,
    },
    build: {
      rollupOptions: {
        input: resolve(__dirname, "../renderer/index.html"),
      },
      outDir: resolve(__dirname, "../renderer/dist"),
    },
  },
});
