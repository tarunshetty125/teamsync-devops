import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@tiptap")) return "rich-text";
          if (id.includes("@dnd-kit")) return "drag-drop";
          if (id.includes("@emoji-mart/data")) return "emoji-data";
          if (id.includes("@emoji-mart/react")) return "emoji-picker";
          if (id.includes("socket.io-client")) return "realtime";
          if (id.includes("@tanstack")) return "tanstack";
          if (id.includes("@radix-ui")) return "radix-ui";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("date-fns")) return "date";
          if (id.includes("react") || id.includes("react-dom")) return "react";
        },
      },
    },
  },
});
