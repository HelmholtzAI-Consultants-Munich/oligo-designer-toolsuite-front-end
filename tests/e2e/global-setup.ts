import { pollUntil } from "./helpers";
import dotenv from "dotenv";

dotenv.config();

const APP_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const BACKEND_URL =
    process.env.PLAYWRIGHT_BACKEND_URL || "http://localhost:8000";
const TIMEOUT_MS = 120_000;
const POLL_MS = 3_000;

async function waitForUrl(url: string, label: string) {
    let attempts = 0;
    await pollUntil({
        condition: async () => {
            attempts++;
            try {
                const res = await fetch(url);
                if (res.ok) {
                    console.log(
                        `  ${label} ready after ${attempts} attempt(s)`
                    );
                    return true;
                }
            } catch {
                // not ready yet
            }
            return false;
        },
        timeoutMs: TIMEOUT_MS,
        intervalMs: POLL_MS,
        timeoutMessage: `${label} (${url}) did not become ready within ${TIMEOUT_MS / 1000}s`,
    });
}

export default async function globalSetup() {
    console.log("Waiting for application stack…");
    await Promise.all([
        waitForUrl(`${APP_URL}/pipelines`, "Frontend"),
        waitForUrl(`${BACKEND_URL}/api/runs`, "Backend API"),
    ]);
    console.log("Application stack is ready.");
}
