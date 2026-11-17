import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  define: {
    "import.meta.env.VITE_SITE_URL": JSON.stringify(process.env.VITE_SITE_URL?.replace(/\/$/, "") || "."),
  },
  plugins: [react()],
});
