import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ browserName: 'chromium' });

test('E2E: submit OligoSeq form with gene and FASTA files', async ({ page }) => {
  test.setTimeout(300_000); // ⏱️ Set test-wide timeout to 10 minutes
  // 1. Go to oligoseq page
  await page.goto('http://localhost:3000/pipelines/merfish');

  // 2. Fill in the gene input
  const geneInput = page.locator('input[name="file_regions"]');
  await expect(geneInput).toBeVisible();
  await geneInput.fill('AARS1');

  // 4. Upload target probe database FASTA
  const fastaTargetInput = page.locator('input[name="files_fasta_target_probe_database"]');
  await expect(fastaTargetInput).toBeVisible();
  await fastaTargetInput.setInputFiles(
    path.resolve(__dirname, 'mock_data/utr_annotation_source-NCBI_species-Homo_sapiens_annotation_release-110_genome_assemly-GRCh38.fna')
  );

  // 5. Upload reference probe database FASTA
  const fastaRefInput = page.locator('input[name="files_fasta_reference_database_target_probe"]');
  await expect(fastaRefInput).toBeVisible();
  await fastaRefInput.setInputFiles(
    path.resolve(__dirname, 'mock_data/utr_annotation_source-NCBI_species-Homo_sapiens_annotation_release-110_genome_assemly-GRCh38.fna')
  );

  await page.getByRole('button', { name: 'Readout Probe Parameters' }).click();
  await expect(page.getByRole('button', { name: 'Readout Probe Parameters' })).toHaveClass(/active/);


  // 5. Upload reference probe database FASTA
  const fastaRefProbeInput = page.locator('input[name="files_fasta_reference_database_readout_probe"]');
  await expect(fastaRefProbeInput).toBeVisible();
  await fastaRefProbeInput.setInputFiles(
    path.resolve(__dirname, 'mock_data/utr_annotation_source-NCBI_species-Homo_sapiens_annotation_release-110_genome_assemly-GRCh38.fna')
  );

  await page.getByRole('button', { name: 'Primer Parameters' }).click();
  await expect(page.getByRole('button', { name: 'Primer Parameters' })).toHaveClass(/active/);


  // 5. Upload reference probe database FASTA
  const fastaRefPrimerInput = page.locator('input[name="files_fasta_reference_database_primer"]');
  await expect(fastaRefPrimerInput).toBeVisible();
  await fastaRefPrimerInput.setInputFiles(
    path.resolve(__dirname, 'mock_data/utr_annotation_source-NCBI_species-Homo_sapiens_annotation_release-110_genome_assemly-GRCh38.fna')
  );

  // 7. Click Submit button
  const submitButton = page.getByRole('button', { name: /submit/i });
  await expect(submitButton).toBeVisible();
  await submitButton.click();

  // 6. Wait for dialogs after submission and assert the FINAL success message
  const timeoutMs = 600_000; // up to 10 minutes for the whole pipeline
  let gotSuccess = false;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const remaining = Math.max(0, deadline - Date.now());
    const dialog = await page.waitForEvent('dialog', { timeout: remaining });
    const message = dialog.message();
    console.log('Alert:', message);
    await dialog.dismiss();

    // Ignore any intermediate alerts (e.g., RunID ...) and only pass when the final success appears
    if (/pipeline is successfully finished/i.test(message)) {
      gotSuccess = true;
      break;
    }
  }

  expect(gotSuccess, 'Expected a final "Pipeline is successfully finished" alert').toBeTruthy();
});