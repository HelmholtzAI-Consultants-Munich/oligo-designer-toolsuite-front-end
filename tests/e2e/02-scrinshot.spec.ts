// Runs a full pipeline, so it carries no @smoke/@full tag and CI skips it; run it
// manually with an untagged `playwright test`.

import { test } from "@playwright/test";
import {
    SCRINSHOT_PIPELINE,
    fillConfig,
    fillRequiredParameters,
    openPipeline,
    submitAndVerifyRun,
} from "./helpers";

test("scrinshot run completes and exposes artifacts", async ({ page }) => {
    await openPipeline(page, SCRINSHOT_PIPELINE);

    await fillRequiredParameters(page, {
        targets: "AARS1",
    });

    await fillConfig(page, {
        nAttemptsGraph: "60",
        setSizeMin: "2",
    });

    await submitAndVerifyRun(page);
});
