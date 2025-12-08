import axios from "axios";

export async function createRunId() {
    try {
        const response = await axios.post(
            "http://localhost:5000/api/init_run_id",
            null,
            {
                withCredentials: true,
            }
        );

        const runId = response.data.run_id;
        console.log("🧪 New Run ID:", runId);

        return runId;
    } catch (error) {
        console.error("Failed to create run:", error);
        return null;
    }
}

export async function copyToClipboard(text: string) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        return false;
    }
}
