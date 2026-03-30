const APP_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const BACKEND_URL =
    process.env.PLAYWRIGHT_BACKEND_URL || "http://localhost:5000";
const TIMEOUT_MS = 120_000;
const POLL_MS = 3_000;

async function waitForUrl(url: string, label: string) {
    const deadline = Date.now() + TIMEOUT_MS;
    let attempts = 0;
    while (Date.now() < deadline) {
        attempts++;
        try {
            const res = await fetch(url);
            if (res.ok) {
                console.log(`  ${label} ready after ${attempts} attempt(s)`);
                return;
            }
        } catch {
            // not ready yet
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
    }
    throw new Error(
        `${label} (${url}) did not become ready within ${TIMEOUT_MS / 1000}s`
    );
}

export default async function globalSetup() {
    console.log("Waiting for application stack…");
    await Promise.all([
        waitForUrl(`${APP_URL}/pipelines`, "Frontend"),
        waitForUrl(`${BACKEND_URL}/api/pipelines`, "Backend API"),
    ]);
    console.log("Application stack is ready.");
}
