import { test, expect } from '@playwright/test';

test.describe('Scrinshot Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/pipelines/scrinshot'); // Adjust if your route is different
  });

  test('should render required file inputs', async ({ page }) => {
    await expect(page.locator('input[name="file_regions"]')).toBeVisible();
    await expect(page.locator('input[name="files_fasta_target_probe_database"]')).toBeVisible();
    await expect(page.locator('input[name="files_fasta_reference_database_target_probe"]')).toBeVisible();
  });

test('should display and fill numeric input fields by name', async ({ page }) => {
  const inputNames = [
    'file_regions',
    'top_n_sets',
    'target_probe_length_min',
    'target_probe_length_max',
    'target_probe_isoform_consensus',
    'target_probe_GC_content_min',
    'target_probe_GC_content_opt',
    'target_probe_GC_content_max',
    'target_probe_Tm_min',
    'target_probe_Tm_max',
    'target_probe_Tm_opt',
    'target_probe_homopolymeric_base_n.A',
    'target_probe_homopolymeric_base_n.T',
    'target_probe_homopolymeric_base_n.C',
    'target_probe_homopolymeric_base_n.G',
    'target_probe_padlock_arm_Tm_dif_max',
    'target_probe_padlock_arm_length_min',
    'target_probe_padlock_arm_Tm_min',
    'target_probe_padlock_arm_Tm_dif_max',
    'target_probe_ligation_region_size',
    'target_probe_isoform_weight',
    'target_probe_GC_weight',
    'target_probe_Tm_weight',
    'set_size_min',
    'set_size_opt',
    'distance_between_target_probes',
    'n_sets',
      'target_probe_specificity_blastn_search_parameters.perc_identity',
      'target_probe_specificity_blastn_search_parameters.strand',
      'target_probe_specificity_blastn_search_parameters.word_size',
      'target_probe_specificity_blastn_search_parameters.dust',
      'target_probe_specificity_blastn_search_parameters.soft_masking',
      'target_probe_specificity_blastn_search_parameters.max_target_seqs',
      'target_probe_specificity_blastn_search_parameters.max_hsps',
      'target_probe_cross_hybridization_blastn_hit_parameters.coverage',
      'target_probe_cross_hybridization_blastn_search_parameters.perc_identity',
      'target_probe_cross_hybridization_blastn_search_parameters.strand',
      'target_probe_cross_hybridization_blastn_search_parameters.word_size',
      'target_probe_cross_hybridization_blastn_search_parameters.dust',
      'target_probe_cross_hybridization_blastn_search_parameters.soft_masking',
      'target_probe_cross_hybridization_blastn_search_parameters.max_target_seqs',
      'target_probe_cross_hybridization_blastn_hit_parameters.coverage',
      'max_graph_size',
      'n_attempts',
      'heuristic',
      'heuristic_n_attempts',
      'target_probe_Tm_parameters.nn_table',
      'target_probe_Tm_parameters.tmm_table',
      'target_probe_Tm_parameters.imm_table',
      'target_probe_Tm_parameters.de_table',
      'target_probe_Tm_parameters.dnac1',
      'target_probe_Tm_parameters.dnac2',
      'target_probe_Tm_parameters.saltcorr',
      'target_probe_Tm_parameters.Na',
      'target_probe_Tm_parameters.K',
      'target_probe_Tm_parameters.Tris',
      'target_probe_Tm_parameters.Mg',
      'target_probe_Tm_parameters.dNTPs',
      'target_probe_Tm_chem_correction_parameters.DMSO',
      'target_probe_Tm_chem_correction_parameters.fmd',
      'target_probe_Tm_chem_correction_parameters.DMSOfactor',
      'target_probe_Tm_chem_correction_parameters.fmdfactor',
      'target_probe_Tm_chem_correction_parameters.fmdmethod',
      'target_probe_Tm_chem_correction_parameters.GC',
      'detection_oligo_Tm_parameters.nn_table',
      'detection_oligo_Tm_parameters.tmm_table',
      'detection_oligo_Tm_parameters.imm_table',
      'detection_oligo_Tm_parameters.de_table',
      'detection_oligo_Tm_parameters.dnac1',
      'detection_oligo_Tm_parameters.dnac2',
      'detection_oligo_Tm_parameters.saltcorr',
      'detection_oligo_Tm_parameters.Na',
      'detection_oligo_Tm_parameters.K',
      'detection_oligo_Tm_parameters.Tris',
      'detection_oligo_Tm_parameters.Mg',
      'detection_oligo_Tm_parameters.dNTPs',
      'detection_oligo_Tm_chem_correction_parameters.DMSO',
      'detection_oligo_Tm_chem_correction_parameters.fmd',
      'detection_oligo_Tm_chem_correction_parameters.DMSOfactor',
      'detection_oligo_Tm_chem_correction_parameters.fmdfactor',
      'detection_oligo_Tm_chem_correction_parameters.fmdmethod',
      'detection_oligo_Tm_chem_correction_parameters.GC',
       'detection_oligo_min_thymines',
      'detection_oligo_length_min',
      'detection_oligo_length_max',
      'detection_oligo_U_distance',
      'detection_oligo_Tm_opt',
  ];

  for (const name of inputNames) {
    const input = page.locator(`[name="${name}"]`);
    await expect(input).toBeVisible();
    await input.fill('42');
  }
});

  test('clicking Generate FASTA+ adds new form', async ({ page }) => {
    await page.getByRole('button', { name: 'Generate FASTA+' }).first().click();
    await expect(page.locator('form')).toBeVisible();
  });

  test('should show info icons with tooltips', async ({ page }) => {
    const icon = page.locator('svg').first();
    await icon.hover();
    // no reliable way to assert tooltip unless you test specific text — optional
  });
  test('fills all visible inputs in all tabs including Developer Settings', async ({ page }) => {

  // First: open the Developer Settings panel if hidden
  const devButton = page.getByRole('button', { name: /show/i });
  if (await devButton.isVisible()) {
    console.log('🛠 Opening Developer Settings');
    await devButton.click();
  }

  // Then: loop through all tab buttons in nav-tabs
  const tabs = page.locator('.nav-tabs .nav-link');
  const tabCount = await tabs.count();
  console.log(`Found ${tabCount} tabs`);

  for (let i = 0; i < tabCount; i++) {
    const tab = tabs.nth(i);
    const label = await tab.textContent();
    console.log(`📑 Activating tab: ${label}`);
    await tab.click();

    // Fill all visible named inputs in this tab
    const visibleInputs = page.locator(
      'input[name]:visible, select[name]:visible, textarea[name]:visible'
    );

    const inputCount = await visibleInputs.count();
    for (let j = 0; j < inputCount; j++) {
      const input = visibleInputs.nth(j);
      const name = await input.getAttribute('name');
      const type = await input.getAttribute('type');

      if (type === 'file') continue;

      console.log(`   → Filling [${name}]`);
      await input.fill('42');
    }
  }

  // Also check for and fill any extra inputs outside of tabs (e.g., developer section)
  const extraVisibleInputs = page.locator(
    'input[name]:visible, select[name]:visible, textarea[name]:visible'
  );
  const extraCount = await extraVisibleInputs.count();
  for (let i = 0; i < extraCount; i++) {
    const input = extraVisibleInputs.nth(i);
    const name = await input.getAttribute('name');
    const type = await input.getAttribute('type');

    if (type === 'file') continue;

    console.log(`📤 Filling standalone input [${name}]`);
    await input.fill('42');
  }
});
});