import axios from "axios";
import { BACKEND_URL } from "../config";

export async function createRunId() {
    try {
        const response = await axios.post(
            BACKEND_URL + "/api/init_run_id",
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
