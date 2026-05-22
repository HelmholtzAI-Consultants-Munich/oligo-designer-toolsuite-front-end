import { test } from "@playwright/test";
import {
    FASTA_FIXTURES,
    OLIGOSEQ_PIPELINE,
    fillDeveloperSettings,
    fillTargetProbeParameters,
    openPipeline,
    submitAndVerifyRun,
} from "./helpers";

test("@smoke @full oligoseq run completes and exposes artifacts", async ({
    page,
}) => {
    await openPipeline(page, OLIGOSEQ_PIPELINE);

    await fillTargetProbeParameters(page, {
        fileRegions: "AARS1",
        fastaTargetFiles: [
            FASTA_FIXTURES.exon,
            FASTA_FIXTURES.exon_exon_junction,
        ],
        fastaReferenceFiles: [
            FASTA_FIXTURES.exon,
            FASTA_FIXTURES.exon_exon_junction,
        ],
        fastaVcfFiles: [FASTA_FIXTURES.vcf],
    });

    await fillDeveloperSettings(page, {
        maxGraphSize: "6000",
        nAttempts: "120000",
    });

    await submitAndVerifyRun(page);
});
