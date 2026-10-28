async (page) => {
  await page.evaluate(() => document.querySelector('.painel-theme')?.classList.add('theme-dark'));
  await page.waitForTimeout(500);
  await page.screenshot({path:'output/playwright/blog-summary-dark-stable.png',fullPage:true});
}
