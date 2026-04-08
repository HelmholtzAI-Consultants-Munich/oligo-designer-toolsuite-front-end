import { expect, type Page } from "@playwright/test";
import path from "node:path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BACKEND_URL =
    process.env.PLAYWRIGHT_BACKEND_URL || "http://localhost:5000";
const POLL_INTERVAL_MS = 2_000;
const RUN_TIMEOUT_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------------------
// Generic polling utility
// ---------------------------------------------------------------------------

/**
 * Polls a condition function until it succeeds or times out.
 *
 * @param options.condition - Async function that returns true when done, false to keep polling
 * @param options.timeoutMs - Maximum time to wait in milliseconds
 * @param options.intervalMs - Polling interval in milliseconds
 * @param options.timeoutMessage - Error message if timeout occurs
 */
export const pollUntil = async <T = void>(options: {
    condition: () => Promise<T | false | null | undefined>;
    timeoutMs: number;
    intervalMs: number;
    timeoutMessage: string;
}): Promise<T> => {
    const deadline = Date.now() + options.timeoutMs;

    while (Date.now() < deadline) {
        const result = await options.condition();
        if (result !== false && result !== null && result !== undefined) {
            return result as T;
        }
        await new Promise((r) => setTimeout(r, options.intervalMs));
    }

    throw new Error(options.timeoutMessage);
};

// ---------------------------------------------------------------------------
// FASTA fixtures — only the smallest bundled files (~4.8 MB + ~6.4 MB)
// ---------------------------------------------------------------------------

const GENOMIC_REGIONS_DIR = path.resolve(
    process.cwd(),
    "backend/data/genomic_regions"
);

export const FASTA_FIXTURES = {
    utr: path.join(
        GENOMIC_REGIONS_DIR,
        "utr_annotation_source-NCBI_species-Homo_sapiens_annotation_release-110_genome_assemly-GRCh38.fna"
    ),
    cds: path.join(
        GENOMIC_REGIONS_DIR,
        "cds_annotation_source-NCBI_species-Homo_sapiens_annotation_release-110_genome_assemly-GRCh38.fna"
    ),
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PipelineDefinition = {
    route: string;
    heading: RegExp;
    pipeline: string;
    expectedTabs: RegExp[];
    representativeFieldChecks?: Array<{ tab: RegExp; label: RegExp }>;
};

type RunFile = { name: string; type: string; size: number };

// ---------------------------------------------------------------------------
// Pipeline definitions (used by the smoke test)
// ---------------------------------------------------------------------------

export const SCRINSHOT_PIPELINE: PipelineDefinition = {
    route: "/pipelines/scrinshot",
    heading: /Scrinshot/i,
    pipeline: "scrinshot",
    expectedTabs: [
        /Target Probe Parameters/i,
        /Detection Oligo Parameters/i,
        /Developer Settings/i,
    ],
    representativeFieldChecks: [
        { tab: /Target Probe Parameters/i, label: /File Regions/i },
    ],
};

export const OLIGOSEQ_PIPELINE: PipelineDefinition = {
    route: "/pipelines/oligoSeq",
    heading: /OligoSeq/i,
    pipeline: "oligoseq",
    expectedTabs: [/Target Probe Parameters/i, /Developer Settings/i],
    representativeFieldChecks: [
        { tab: /Target Probe Parameters/i, label: /File Regions/i },
    ],
};

export const MERFISH_PIPELINE: PipelineDefinition = {
    route: "/pipelines/merfish",
    heading: /MERFISH/i,
    pipeline: "merfish",
    expectedTabs: [
        /Target Probe Parameters/i,
        /Readout Probe Parameters/i,
        /Primer Parameters/i,
        /Developer Settings/i,
    ],
    representativeFieldChecks: [
        { tab: /Target Probe Parameters/i, label: /File Regions/i },
    ],
};

export const SEQFISH_PIPELINE: PipelineDefinition = {
    route: "/pipelines/seqfish",
    heading: /seqFISH/i,
    pipeline: "seqfish",
    expectedTabs: [
        /Target Probe Parameters/i,
        /Readout Probe Parameters/i,
        /Primer Parameters/i,
        /Developer Settings/i,
    ],
    representativeFieldChecks: [
        { tab: /Target Probe Parameters/i, label: /File Regions/i },
    ],
};

export const ALL_PIPELINES: PipelineDefinition[] = [
    SCRINSHOT_PIPELINE,
    OLIGOSEQ_PIPELINE,
    MERFISH_PIPELINE,
    SEQFISH_PIPELINE,
];

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

export const clickTab = async (page: Page, name: RegExp) => {
    await page.getByRole("tab", { name }).click();
};

export const openPipeline = async (
    page: Page,
    pipeline: PipelineDefinition
) => {
    await page.goto(pipeline.route);
    await expect(
        page.getByRole("heading", { name: pipeline.heading })
    ).toBeVisible();
};

export const expectPipelineFields = async (
    page: Page,
    pipeline: PipelineDefinition
) => {
    for (const tab of pipeline.expectedTabs) {
        await expect(page.getByRole("tab", { name: tab })).toBeVisible();
    }

    for (const check of pipeline.representativeFieldChecks ?? []) {
        await clickTab(page, check.tab);
        await expect(page.getByLabel(check.label)).toBeVisible();
    }
};

// ---------------------------------------------------------------------------
// Submission & consent
// ---------------------------------------------------------------------------

export const submitPipelineAndOpenRun = async (page: Page) => {
    const submitButton = page.getByRole("button", { name: /submit/i });
    await submitButton.click();

    const termsCheckbox = page.getByRole("checkbox", {
        name: /I accept the Terms of Service and acknowledge the Privacy Policy/i,
    });
    const needsConsent = await termsCheckbox
        .waitFor({ state: "visible", timeout: 1_000 })
        .then(() => true)
        .catch(() => false);
    if (needsConsent) {
        await termsCheckbox.check();
        await expect(termsCheckbox).toBeChecked();
    }

    const modal = page
        .getByRole("dialog")
        .filter({ hasText: /Pipeline Enqueued/i });
    const modalAppeared = await modal
        .waitFor({ state: "visible", timeout: 1_000 })
        .then(() => true)
        .catch(() => false);
    if (!modalAppeared) {
        await submitButton.click();
    }
    await expect(modal).toBeVisible();

    await modal.getByRole("button", { name: "Show Run" }).click();
    await expect(page).toHaveURL(/\/runs\/[a-f0-9]{24}$/i);

    const runId = page.url().match(/\/runs\/([a-f0-9]{24})$/i)?.[1];
    expect(runId, "Expected run ID in run details URL").toBeTruthy();
    return runId as string;
};

const backendGet = (page: Page, apiPath: string) =>
    page.request.get(`${BACKEND_URL}${apiPath}`);

const pollRunState = async (page: Page, runId: string, timeoutMs: number) => {
    return pollUntil({
        condition: async () => {
            const res = await backendGet(page, `/api/runs/${runId}/state`);
            expect(
                res.ok(),
                `Run state: ${res.status()} ${res.statusText()}`
            ).toBeTruthy();

            const { state } = await res.json();
            if (state === "success") return true;
            if (state === "failure") {
                throw new Error(`Pipeline run ${runId} finished with failure.`);
            }
            return false;
        },
        timeoutMs,
        intervalMs: POLL_INTERVAL_MS,
        timeoutMessage: `Timed out waiting for pipeline run ${runId} to succeed.`,
    });
};

const pollRunFiles = async (
    page: Page,
    runId: string,
    timeoutMs: number
): Promise<RunFile[]> => {
    return pollUntil({
        condition: async () => {
            const res = await backendGet(page, `/api/runs/${runId}/files`);
            expect(
                res.ok(),
                `Run files: ${res.status()} ${res.statusText()}`
            ).toBeTruthy();

            const files: RunFile[] = await res.json();
            const hasGenomic = files.some(
                (f) => f.name === "genomic_regions.yaml"
            );
            const hasConfig = files.some((f) =>
                /\.(?:ya?ml|txt|log)$/i.test(f.name)
            );

            return hasGenomic && hasConfig ? files : false;
        },
        timeoutMs,
        intervalMs: POLL_INTERVAL_MS,
        timeoutMessage: `Timed out waiting for run ${runId} to expose genomic and config artifacts.`,
    });
};

export const waitForSuccessfulRun = async (
    page: Page,
    runId: string,
    timeoutMs: number = RUN_TIMEOUT_MS
) => {
    const deadline = Date.now() + timeoutMs;
    await pollRunState(page, runId, timeoutMs);
    return pollRunFiles(page, runId, deadline - Date.now());
};

export const expectRunDetailToRenderResults = async (page: Page) => {
    // After long Node.js-side API polling the browser tab has been idle;
    // reload so the page reflects the final backend state.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
        page.getByRole("heading", { name: "Run Files" })
    ).toBeVisible();
    await expect(page.getByText("Gene Analysis")).toBeVisible({
        timeout: 60_000,
    });
};

// ---------------------------------------------------------------------------
// Form filling helpers
// ---------------------------------------------------------------------------

export const fillTargetProbeParameters = async (
    page: Page,
    options: {
        fileRegions: string;
        fastaTargetFiles: string[];
        fastaReferenceFiles: string[];
    }
) => {
    await page.getByLabel(/File Regions/i).fill(options.fileRegions);
    await page
        .getByLabel(/Files Fasta Target Probe Database/i)
        .setInputFiles(options.fastaTargetFiles);
    await page
        .getByLabel(/Files Fasta Reference Database Target Probe/i)
        .setInputFiles(options.fastaReferenceFiles);
};

export const fillReadoutProbeParameters = async (
    page: Page,
    options: {
        fastaReferenceFiles: string[];
    }
) => {
    await clickTab(page, /Readout Probe Parameters/i);
    await page
        .getByLabel(/Files Fasta Reference Database Readout Probe/i)
        .setInputFiles(options.fastaReferenceFiles);
};

export const fillPrimerParameters = async (
    page: Page,
    options: {
        fastaReferenceFiles: string[];
    }
) => {
    await clickTab(page, /Primer Parameters/i);
    await page
        .getByLabel(/Files Fasta Reference Database Primer/i)
        .setInputFiles(options.fastaReferenceFiles);
};

export const fillDeveloperSettings = async (
    page: Page,
    options: {
        maxGraphSize?: string;
        nAttempts?: string;
        readoutProbeInitialNumSequences?: string;
        primerInitialNumSequences?: string;
        setSizeMin?: string;
        setSizeOpt?: string;
    }
) => {
    await clickTab(page, /Developer Settings/i);

    if (options.maxGraphSize) {
        await page.getByLabel(/Max Graph Size/i).fill(options.maxGraphSize);
    }
    if (options.nAttempts) {
        await page.getByLabel(/^N Attempts$/i).fill(options.nAttempts);
    }
    if (options.readoutProbeInitialNumSequences) {
        await page
            .getByLabel(/Readout Probe Initial Num Sequences/i)
            .fill(options.readoutProbeInitialNumSequences);
    }
    if (options.primerInitialNumSequences) {
        await page
            .getByLabel(/Primer Initial Num Sequences/i)
            .fill(options.primerInitialNumSequences);
    }
    if (options.setSizeMin || options.setSizeOpt) {
        await clickTab(page, /Target Probe Parameters/i);
        if (options.setSizeMin) {
            await page.getByLabel(/Set Size Min/i).fill(options.setSizeMin);
        }
        if (options.setSizeOpt) {
            await page.getByLabel(/Set Size Opt/i).fill(options.setSizeOpt);
        }
    }
};
