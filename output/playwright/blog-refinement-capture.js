async (page) => {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Gestão de conteúdo' }).waitFor();
  await page.getByText('Artigos publicados').waitFor();
  await page.evaluate(() => document.fonts.ready);
  const measurements = [];
  for (const [width, height] of [[1920, 1080], [768, 1024], [390, 844], [320, 640]]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `output/playwright/blog-refinement-${width}-light.png`, fullPage: true, animations: 'disabled' });
    measurements.push(await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })));
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator('.painel-theme').first().evaluate(element => element.classList.add('theme-dark'));
  await page.screenshot({ path: 'output/playwright/blog-refinement-1920-dark.png', fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'output/playwright/blog-refinement-390-dark.png', fullPage: true, animations: 'disabled' });
  return { measurements, writes: 0, loaded: await page.getByText('Guia de planos de saúde').count() };
}
