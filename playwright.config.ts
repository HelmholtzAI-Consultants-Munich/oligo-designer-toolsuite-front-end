import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

export default defineConfig({
    globalSetup: "./tests/e2e/global-setup.ts",
    testDir: "./tests/e2e",
    timeout: 20 * 60 * 1000,
    expect: {
        timeout: 30 * 1000,
    },
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: 1,
    reporter: [
        ["list"],
        ["html", { open: "never", outputFolder: "playwright-report" }],
    ],
    use: {
        baseURL,
        trace: "retain-on-failure",
        video: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    workers: process.env.CI ? 1 : undefined,
    projects: [
        {
            name: "chromium",
            use: {
                browserName: "chromium",
            },
        },
    ],
});
