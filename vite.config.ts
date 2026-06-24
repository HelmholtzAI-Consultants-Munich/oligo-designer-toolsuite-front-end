/// <reference types="vitest/config" />

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
    plugins: [
        react({
            babel: {
                plugins: ["babel-plugin-react-compiler"],
            },
        }),
    ],
    server: {
        open: true,
        port: 3000,
    },
    resolve: {
        alias: {
            "@schemas": path.resolve(__dirname, "schemas/"),
        },
    },
    // https://vitest.dev/config/
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: ["./src/vitest-setup.ts"],
        server: {
            deps: {
                // Inline @rjsf packages to fix ESM resolution issues
                inline: [/@rjsf\/.*/],
            },
        },
    },
    esbuild: {
        drop: mode === "production" ? ["console", "debugger"] : [],
    },
}));
