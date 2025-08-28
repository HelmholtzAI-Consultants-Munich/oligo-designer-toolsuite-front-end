import { test, expect } from '@playwright/test';
import path from 'path';

test('E2E: submit Scrinshot form with gene and FASTA files', async ({ page }) => {
  // 1. Go to Scrinshot page
  await page.goto('http://localhost:3000/pipelines/scrinshot');

  // 2. Fill in the gene input
  const geneInput = page.locator('input[name="file_regions"]');
  await expect(geneInput).toBeVisible();
  await geneInput.fill('AARS1');

  // 3. Upload target gene file
  const fileRegionsFile = page.locator('input[name="file_regions_file"]');
  await expect(fileRegionsFile).toBeVisible();
  await fileRegionsFile.setInputFiles(
    path.resolve(__dirname, 'mock_data/file_regions.fna')
  );

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

  // 6. Wait for alert triggered after successful submission
  page.once('dialog', async (dialog) => {
    const message = dialog.message();
    console.log('✅ Success alert received:', message);
    expect(message).toMatch(/pipeline is successfully finished/i);
    await dialog.dismiss(); // or .accept() if preferred
  });

  // 7. Click Submit button
  const submitButton = page.getByRole('button', { name: /submit/i });
  await expect(submitButton).toBeVisible();
  await submitButton.click();
});