async page => {
  const sizes = [[1920, 1080], [768, 1024], [390, 844], [320, 640]];
  const metrics = [];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(100);
    metrics.push(await page.evaluate(() => {
      const dialog = document.querySelector('.kds-lead-details-drawer');
      const drawerBody = document.querySelector('.kds-lead-details-drawer-body');
      const footer = document.querySelector('.kds-lead-details-drawer-footer');
      const rect = (element) => element ? { x: Math.round(element.getBoundingClientRect().x), y: Math.round(element.getBoundingClientRect().y), width: Math.round(element.getBoundingClientRect().width), height: Math.round(element.getBoundingClientRect().height) } : null;
      return {
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        clientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        drawer: rect(dialog),
        drawerBody: rect(drawerBody),
        drawerContentScrollHeight: drawerBody?.scrollHeight,
        footer: rect(footer),
        footerButtons: [...(footer?.querySelectorAll('button') ?? [])].map(rect),
      };
    }));
  }
  return metrics;
}
