// Scrinshot isn't in ALL_PIPELINES yet (pydantic integration pending). This
// spec has no @smoke/@full tag, so CI's tag-filtered runs skip it too —
// it only runs via a manual, untagged `playwright test`.

import { test } from "@playwright/test";
import {
    FASTA_FIXTURES,
    SCRINSHOT_PIPELINE,
    fillConfig,
    fillTargetProbeParameters,
    openPipeline,
    submitAndVerifyRun,
} from "./helpers";

test("scrinshot run completes and exposes artifacts", async ({ page }) => {
    await openPipeline(page, SCRINSHOT_PIPELINE);

    await fillTargetProbeParameters(page, {
        fileRegions: "AARS1",
        fastaTargetFiles: [FASTA_FIXTURES.utr],
        fastaReferenceFiles: [FASTA_FIXTURES.utr],
    });

    await fillConfig(page, {
        nAttemptsGraph: "60",
        setSizeMin: "2",
    });

    await submitAndVerifyRun(page);
});
