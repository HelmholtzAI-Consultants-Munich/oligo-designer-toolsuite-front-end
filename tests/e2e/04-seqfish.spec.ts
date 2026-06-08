import { test } from "@playwright/test";
import {
    FASTA_FIXTURES,
    SEQFISH_PIPELINE,
    fillConfig,
    fillPrimerParameters,
    fillReadoutProbeParameters,
    fillTargetProbeParameters,
    openPipeline,
    submitAndVerifyRun,
} from "./helpers";

test("seqfish run completes and exposes artifacts", async ({ page }) => {
    await openPipeline(page, SEQFISH_PIPELINE);

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
        setSizeMin: "2",
        readoutProbeInitialNumSequences: "10000",
        primerInitialNumSequences: "50000",
    });

    await submitAndVerifyRun(page);
});
