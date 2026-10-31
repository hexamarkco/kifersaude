async (page) => {
  await page.goto('http://127.0.0.1:5173/output/playwright/contracts-import-single-preview/index.html?theme=light');
  await page.evaluate(() => document.fonts.ready);
  const out = [];
  for (const [width, height] of [[1920,1080],[768,1024],[390,844],[320,640]]) {
    await page.setViewportSize({width,height});
    out.push(await page.evaluate(() => {
      const dialog = document.querySelector('.kds-dialog');
      const footer = document.querySelector('.kds-contract-json-import-footer');
      return {
        viewport: `${innerWidth}x${innerHeight}`,
        documentWidth: document.documentElement.scrollWidth,
        dialog: dialog ? Math.round(dialog.getBoundingClientRect().width) : null,
        footer: footer ? Math.round(footer.getBoundingClientRect().height) : null,
        buttons: Array.from(footer?.querySelectorAll('button') ?? []).map(button => ({
          label: button.innerText,
          width: Math.round(button.getBoundingClientRect().width),
          height: Math.round(button.getBoundingClientRect().height),
          lines: Math.round(button.getBoundingClientRect().height / parseFloat(getComputedStyle(button).lineHeight)),
        })),
      };
    }));
  }
  return out;
}
