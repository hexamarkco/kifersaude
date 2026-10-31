async (page) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const posts = Array.from({ length: 12 }, (_, index) => ({
    id: `synthetic-${index + 1}`,
    title: `Artigo de demonstração ${String(index + 1).padStart(2, '0')}`,
    slug: `artigo-demonstracao-${index + 1}`,
    excerpt: 'Conteúdo sintético para comparar coberturas, prazos e opções de atendimento.',
    content: '<p>Conteúdo sintético de demonstração.</p>',
    category: index % 2 ? 'Guias' : 'Planos',
    read_time: `${3 + (index % 4)} min`,
    author_id: 'operator-demo',
    published: index % 3 === 0,
    created_at: `2026-10-${String(30 - index).padStart(2, '0')}T12:00:00Z`,
    updated_at: `2026-10-${String(30 - index).padStart(2, '0')}T12:00:00Z`,
    views_count: 124 - (index * 8),
  }));
  let writes = 0;
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
    if (url.pathname.endsWith('/rest/v1/blog_posts') && request.method() === 'GET') {
      return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify(posts) });
    }
    if (request.method() !== 'GET' && request.method() !== 'OPTIONS') writes += 1;
    return route.abort();
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://127.0.0.1:5173/output/playwright/blog-integrated.html', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Gestão de conteúdo' }).waitFor();
  await page.getByText('Artigos publicados').waitFor();
  await page.evaluate(() => document.fonts.ready);
  const measurements = [];
  for (const [width, height] of [[1920, 1080], [768, 1024], [390, 844], [320, 640]]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `output/playwright/blog-review-${width}-light.png`, fullPage: true, animations: 'disabled' });
    measurements.push(await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })));
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator('.painel-theme').first().evaluate(element => element.classList.add('theme-dark'));
  await page.screenshot({ path: 'output/playwright/blog-review-1920-dark.png', fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'output/playwright/blog-review-390-dark.png', fullPage: true, animations: 'disabled' });
  await page.locator('.painel-theme').first().evaluate(element => element.classList.remove('theme-dark'));
  await page.getByRole('textbox', { name: 'Buscar artigos' }).fill('demonstração 01');
  const searchRows = await page.locator('tbody tr').count();
  await page.getByRole('textbox', { name: 'Buscar artigos' }).fill('');
  await page.getByRole('button', { name: 'Todos os status' }).click();
  await page.getByRole('option', { name: 'Rascunho' }).click();
  const draftRows = await page.locator('tbody tr').count();
  await page.getByRole('button', { name: 'Rascunho' }).click();
  await page.getByRole('option', { name: 'Todos os status' }).click();
  await page.getByRole('button', { name: 'Próxima página' }).click();
  const pageTwoRows = await page.locator('tbody tr').count();
  await page.setViewportSize({ width: 390, height: 844 });
  const cardMenu = page.locator('.kds-collection-cards button[aria-haspopup="menu"]').first();
  await cardMenu.click();
  const menuItems = await page.getByRole('menuitem').allInnerTexts();
  await page.screenshot({ path: 'output/playwright/blog-review-390-actions-menu.png', fullPage: true, animations: 'disabled' });
  await page.keyboard.press('Escape');
  return { measurements, searchRows, draftRows, pageTwoRows, menuItems, writes };
}
