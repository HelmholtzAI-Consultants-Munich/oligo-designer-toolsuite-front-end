import axios from "axios";

export async function createRunId() {
    try {
        const response = await axios.post(
            "http://localhost:5000/api/init_run_id",
            {},
            {
                withCredentials: true,
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );

        const runId = response.data.run_id;
        console.log("🧪 New Run ID:", runId);

        // Try to copy it to clipboard
        try {
            await navigator.clipboard.writeText(runId);
            alert(`RunID copied to clipboard:\n${runId}`);
        } catch (copyErr) {
            console.warn("📋 Clipboard copy failed, falling back to alert.");
        }

        return runId;
    } catch (error) {
        console.error("❌ Failed to create run:", error);
        return null;
    }
}