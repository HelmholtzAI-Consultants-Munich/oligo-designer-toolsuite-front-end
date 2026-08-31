// Runs a full pipeline, so it carries no @smoke/@full tag and CI skips it; run it
// manually with an untagged `playwright test`.

import { test } from "@playwright/test";
import {
    SEQFISH_PIPELINE,
    fillConfig,
    fillRequiredParameters,
    openPipeline,
    submitAndVerifyRun,
} from "./helpers";

test("seqfish run completes and exposes artifacts", async ({ page }) => {
    await openPipeline(page, SEQFISH_PIPELINE);

    await fillRequiredParameters(page, {
        targets: "AARS1",
    });

    await fillConfig(page, {
        nAttemptsGraph: "60",
        setSizeMin: "2",
        readoutProbeInitialNumSequences: "10000",
        primerInitialNumSequences: "50000",
    });

    await submitAndVerifyRun(page);
});
