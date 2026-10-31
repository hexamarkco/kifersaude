async (page) => {
  const cases = [
    { name: 'responsive-fixture-desktop-1920x1080', width: 1920, height: 1080, inline: true, contextOnly: false },
    { name: 'responsive-fixture-zoomed-1272x800', width: 1272, height: 800, inline: true, contextOnly: false },
    { name: 'responsive-fixture-tablet-1024x1024', width: 1024, height: 1024, inline: false, contextOnly: true },
    { name: 'responsive-fixture-tablet-768x1024', width: 768, height: 1024, inline: false, contextOnly: true },
    { name: 'responsive-fixture-mobile-390x844', width: 390, height: 844, inline: false, contextOnly: true },
    { name: 'responsive-fixture-mobile-320x640', width: 320, height: 640, inline: false, contextOnly: true },
  ];
  const results = [];
  for (const item of cases) {
    await page.setViewportSize({ width: item.width, height: item.height });
    await page.waitForTimeout(80);
    const metrics = await page.evaluate(() => {
      const bounds = (selector) => {
        const element = document.querySelector(selector);
        const rect = element.getBoundingClientRect();
        return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
      };
      const grid = document.querySelector('.kds-inbox-workspace-grid');
      const panel = document.querySelector('.kds-inbox-lead-context-panel');
      const backdrop = document.querySelector('.kds-inbox-context-backdrop');
      const close = panel.querySelector('button[aria-label="Fechar painel"]');
      const thread = document.querySelector('.whatsapp-inbox-thread');
      const sidebar = document.querySelector('.whatsapp-inbox-sidebar');
      return {
        viewport: { width: innerWidth, height: innerHeight },
        shellWidth: Math.round(document.querySelector('.whatsapp-inbox-shell').getBoundingClientRect().width),
        gridColumns: getComputedStyle(grid).gridTemplateColumns,
        panelPosition: getComputedStyle(panel).position,
        panel: bounds('.kds-inbox-lead-context-panel'),
        thread: bounds('.whatsapp-inbox-thread'),
        threadDisplay: getComputedStyle(thread).display,
        sidebarDisplay: getComputedStyle(sidebar).display,
        backdropDisplay: getComputedStyle(backdrop).display,
        closeButton: (() => { const rect = close.getBoundingClientRect(); return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }; })(),
        documentWidth: document.documentElement.scrollWidth,
      };
    });
    if ((metrics.panelPosition === 'relative') !== (item.inline || item.contextOnly)) throw new Error(`${item.name}: panel layout mismatch ${JSON.stringify(metrics)}`);
    if (item.contextOnly && (metrics.threadDisplay !== 'none' || metrics.sidebarDisplay !== 'none' || metrics.backdropDisplay !== 'none')) throw new Error(`${item.name}: narrow context view did not replace the chat cleanly ${JSON.stringify(metrics)}`);
    if (!item.contextOnly && metrics.backdropDisplay !== 'none') throw new Error(`${item.name}: desktop backdrop should be hidden ${JSON.stringify(metrics)}`);
    if (metrics.documentWidth > item.width) throw new Error(`${item.name}: horizontal overflow ${JSON.stringify(metrics)}`);
    if (metrics.closeButton.x < metrics.panel.x || metrics.closeButton.x + metrics.closeButton.width > metrics.panel.x + metrics.panel.width) throw new Error(`${item.name}: close action outside panel ${JSON.stringify(metrics)}`);
    if (item.contextOnly && metrics.panel.width < metrics.shellWidth - 1) throw new Error(`${item.name}: narrow context view should fill the workspace ${JSON.stringify(metrics)}`);
    await page.screenshot({ path: `C:/Users/Nick Martins/Documents/GitHub/kifersaude/kifersaude-ui-redesign/validacao/revisao-visual/inbox/${item.name}.png` });
    results.push({ name: item.name, ...metrics });
  }
  await page.evaluate(() => document.body.classList.remove('theme-dark'));
  await page.setViewportSize({ width: 1920, height: 1080 });
  const light = await page.evaluate(() => ({ background: getComputedStyle(document.body).getPropertyValue('--bg-canvas').trim(), backdrop: getComputedStyle(document.querySelector('.kds-inbox-context-backdrop')).display, columns: getComputedStyle(document.querySelector('.kds-inbox-workspace-grid')).gridTemplateColumns }));
  await page.screenshot({ path: 'C:/Users/Nick Martins/Documents/GitHub/kifersaude/kifersaude-ui-redesign/validacao/revisao-visual/inbox/responsive-fixture-desktop-light-1920x1080.png' });
  results.push({ name: 'responsive-fixture-desktop-light-1920x1080', ...light });
  return results;
}

