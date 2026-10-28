async page => await page.evaluate(() => ({
  url: location.href,
  viewport: `${innerWidth}x${innerHeight}`,
  dialogs: [...document.querySelectorAll('[role="dialog"]')].map(dialog => ({ label: dialog.getAttribute('aria-label'), title: dialog.querySelector('h1,h2,h3')?.innerText, classes: dialog.className })),
  overlays: [...document.querySelectorAll('.kds-dialog-overlay')].map(overlay => ({ hidden: getComputedStyle(overlay).display === 'none', text: overlay.innerText.slice(0, 200) })),
  themeControls: [...document.querySelectorAll('button[aria-label*="tema"]')].map(button => ({ label: button.getAttribute('aria-label'), disabled: button.disabled, visible: !!button.getClientRects().length })),
  body: document.body.innerText.slice(0,300),
}))
