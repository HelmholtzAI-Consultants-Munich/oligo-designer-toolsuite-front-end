import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        open: true,
        port: 3000,
    },
    // https://vitest.dev/config/
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: ["./src/vitest-setup.ts"],
        exclude: [...configDefaults.exclude, "tests/**"],
    },
});
