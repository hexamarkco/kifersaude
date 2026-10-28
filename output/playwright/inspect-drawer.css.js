async page => await page.evaluate(() => {
  const selectors = ['html', 'body', '.kds-dialog-overlay', '.kds-dialog-container', '.kds-lead-details-drawer'];
  return {
    viewport: { innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
    bodyStyle: document.body.getAttribute('style'),
    elements: selectors.map(selector => {
      const element = document.querySelector(selector);
      if (!element) return { selector, absent: true };
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return { selector, x: box.x, width: box.width, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, cssWidth: style.width, maxWidth: style.maxWidth, padding: style.padding, margin: style.margin, overflow: style.overflow, boxSizing: style.boxSizing };
    }),
  };
})
