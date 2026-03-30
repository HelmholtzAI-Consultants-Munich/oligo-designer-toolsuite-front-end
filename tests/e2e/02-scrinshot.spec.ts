import { expect, test } from "@playwright/test";
import {
    SCRINSHOT_PIPELINE,
    expectRunDetailToRenderResults,
    openPipeline,
    submitPipelineAndOpenRun,
    uploadStandardPipelineInputs,
    waitForSuccessfulRun,
} from "./helpers";

test("@smoke @full scrinshot run completes and exposes artifacts", async ({
    page,
}) => {
    await openPipeline(page, SCRINSHOT_PIPELINE);
    await uploadStandardPipelineInputs(page, SCRINSHOT_PIPELINE);

    const runId = await submitPipelineAndOpenRun(page);
    const files = await waitForSuccessfulRun(page, runId);

    expect(files.some((file) => file.name === "genomic_regions.yaml")).toBe(
        true
    );
    await expectRunDetailToRenderResults(page);
});
