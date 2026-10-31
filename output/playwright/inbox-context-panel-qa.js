async (page) => {
const baseUrl = 'http://127.0.0.1:5173/output/playwright/inbox-context-panel-preview/';
const evidenceDir = 'C:/Users/Nick Martins/Documents/GitHub/kifersaude/kifersaude-ui-redesign/validacao/revisao-visual/inbox/contact-panel';
const cases = [
  { name: 'desktop-1920x1080', width: 1920, height: 1080, wide: true },
  { name: 'desktop-zoom-1272x800', width: 1272, height: 800, wide: true },
  { name: 'tablet-768x1024', width: 768, height: 1024, wide: false },
  { name: 'mobile-390x844', width: 390, height: 844, wide: false },
  { name: 'mobile-320x640', width: 320, height: 640, wide: false },
];

await page.emulateMedia({ reducedMotion: 'reduce' });
const results = [];

for (const theme of ['light', 'dark']) {
  await page.goto(`${baseUrl}?theme=${theme}`);
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: '*,:before,:after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });

  for (const item of cases) {
    await page.setViewportSize({ width: item.width, height: item.height });
    const metrics = await page.evaluate(() => {
      const rect = (selector) => {
        const element = document.querySelector(selector);
        const box = element.getBoundingClientRect();
        return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height), bottom: Math.round(box.bottom) };
      };
      const display = (selector) => getComputedStyle(document.querySelector(selector)).display;
      return {
        viewport: { width: innerWidth, height: innerHeight },
        documentWidth: document.documentElement.scrollWidth,
        root: rect('.whatsapp-inbox-shell'),
        grid: rect('.kds-inbox-workspace-grid'),
        panel: rect('.kds-inbox-lead-context-panel'),
        panelHeaderContent: rect('.kds-inbox-lead-context-panel .kds-dialog-header > div'),
        leadSearchPlaceholder: document.querySelector('.kds-inbox-lead-context-panel input[aria-label="Buscar lead por nome ou telefone"]')?.getAttribute('placeholder'),
        sidebarDisplay: display('.whatsapp-inbox-sidebar'),
        threadDisplay: display('.whatsapp-inbox-thread'),
        composer: rect('.whatsapp-inbox-composer-area'),
        thread: rect('.whatsapp-inbox-thread'),
      };
    });

    if (metrics.documentWidth > item.width) throw new Error(`${theme}/${item.name}: horizontal overflow ${JSON.stringify(metrics)}`);
    if (metrics.leadSearchPlaceholder !== 'Nome ou telefone') throw new Error(`${theme}/${item.name}: compact search placeholder or accessible name changed ${JSON.stringify(metrics)}`);
    if (item.wide && (metrics.sidebarDisplay === 'none' || metrics.threadDisplay === 'none')) throw new Error(`${theme}/${item.name}: desktop columns unexpectedly hidden ${JSON.stringify(metrics)}`);
    if (item.wide && metrics.panel.width < 320) throw new Error(`${theme}/${item.name}: contact panel is too narrow ${JSON.stringify(metrics)}`);
    if (item.wide && metrics.panelHeaderContent.width < 240) throw new Error(`${theme}/${item.name}: contact details are clipped ${JSON.stringify(metrics)}`);
    if (!item.wide && (metrics.sidebarDisplay !== 'none' || metrics.threadDisplay !== 'none' || metrics.panel.width !== metrics.root.width)) throw new Error(`${theme}/${item.name}: compact panel should use the full workspace ${JSON.stringify(metrics)}`);
    if (item.wide && Math.abs(metrics.composer.bottom - metrics.thread.bottom) > 2) throw new Error(`${theme}/${item.name}: composer is not anchored to the conversation bottom ${JSON.stringify(metrics)}`);

    await page.screenshot({ path: `${evidenceDir}/${theme}-${item.name}.png`, fullPage: true, animations: 'disabled' });
    results.push({ theme, name: item.name, ...metrics });
  }
}

await page.setViewportSize({ width: 320, height: 640 });
const mobilePanelScroll = await page.locator('.comm-whatsapp-lead-drawer-body').evaluate((element) => {
  element.scrollTop = element.scrollHeight;
  return {
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
  };
});
if (mobilePanelScroll.scrollHeight <= mobilePanelScroll.clientHeight) throw new Error(`Expected the mobile contact panel body to scroll: ${JSON.stringify(mobilePanelScroll)}`);
await page.screenshot({ path: `${evidenceDir}/dark-mobile-320x640-panel-scrolled.png`, fullPage: true, animations: 'disabled' });
results.push({ theme: 'dark', name: 'mobile-320x640-panel-scrolled', ...mobilePanelScroll });

const mobilePanelActions = await page.locator('.comm-whatsapp-lead-drawer-body').evaluate((element) => {
  element.scrollTop = Math.round((element.scrollHeight - element.clientHeight) / 2);
  return { clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, scrollTop: element.scrollTop };
});
await page.screenshot({ path: `${evidenceDir}/dark-mobile-320x640-panel-actions-scrolled.png`, fullPage: true, animations: 'disabled' });
results.push({ theme: 'dark', name: 'mobile-320x640-panel-actions-scrolled', ...mobilePanelActions });

return results;
}
