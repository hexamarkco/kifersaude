async (page) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const results = [];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1100 });
    for (const kind of ['PF', 'MEI', 'CNPJ']) {
      const input = page.locator(`.home-audience-selector input[value="${kind}"]`);
      await input.locator('..').click();
      const panelId = await input.getAttribute('aria-controls');
      const active = page.locator('.home-audience-panel[aria-hidden="false"]');
      if (await active.getAttribute('id') !== panelId) throw new Error('Radio does not control the visible profile');
      if (await page.locator('#para-quem').getByRole('region').count() !== 1) throw new Error('Inactive profiles exposed to accessibility tree');
      if (await page.locator('#para-quem').getByRole('button').count() !== 1) throw new Error('Inactive quote actions exposed');
      await input.focus();
      await page.keyboard.press('Tab');
      if (!await active.locator('button').evaluate(button => document.activeElement === button)) throw new Error('Tab did not skip inactive slide actions');
      await active.locator('button').click();
      const quoteKind = await page.locator('input[name="quote-contract-type"]:checked').inputValue();
      if (quoteKind !== kind) throw new Error(`Wrong quotation profile ${quoteKind}, expected ${kind}`);
      results.push({ width, kind, quoteKind, keyboard: 'passed', accessibility: 'passed' });
    }
    await page.locator('.home-audience-selector input[value="PF"]').focus();
    await page.keyboard.press('ArrowRight');
    if (!await page.locator('.home-audience-selector input[value="MEI"]').isChecked()) throw new Error('Arrow navigation failed');
    await page.keyboard.press('ArrowRight');
    if (!await page.locator('.home-audience-selector input[value="CNPJ"]').isChecked()) throw new Error('Arrow navigation failed');
    await page.keyboard.press('ArrowRight');
    if (!await page.locator('.home-audience-selector input[value="PF"]').isChecked()) throw new Error('Radio wraparound failed');
  }
  return results;
}
