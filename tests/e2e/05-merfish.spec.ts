// MERFISH isn't in ALL_PIPELINES yet (pydantic integration pending). This
// spec has no @smoke/@full tag, so CI's tag-filtered runs skip it too —
// it only runs via a manual, untagged `playwright test`.

import { test } from "@playwright/test";
import {
    FASTA_FIXTURES,
    MERFISH_PIPELINE,
    fillConfig,
    fillPrimerParameters,
    fillReadoutProbeParameters,
    fillTargetProbeParameters,
    openPipeline,
    submitAndVerifyRun,
} from "./helpers";

test("merfish run completes and exposes artifacts", async ({ page }) => {
    await openPipeline(page, MERFISH_PIPELINE);

    await fillTargetProbeParameters(page, {
        fileRegions: "AARS1",
        fastaTargetFiles: [FASTA_FIXTURES.cds, FASTA_FIXTURES.utr],
        fastaReferenceFiles: [FASTA_FIXTURES.cds, FASTA_FIXTURES.utr],
    });

    await fillReadoutProbeParameters(page, {
        fastaReferenceFiles: [FASTA_FIXTURES.cds, FASTA_FIXTURES.utr],
    });

    await fillPrimerParameters(page, {
        fastaReferenceFiles: [FASTA_FIXTURES.cds, FASTA_FIXTURES.utr],
    });

    await fillConfig(page, {
        nAttemptsGraph: "60",
        setSizeMin: "24",
        setSizeOpt: "24",
    });

    await submitAndVerifyRun(page);
});
