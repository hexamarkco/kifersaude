async (page) => {
  const root = "C:/Users/Nick Martins/Documents/GitHub/kifersaude/kifersaude-ui-redesign/validacao/revisao-visual/commissions/states";
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${root}/day-without-forecast-mobile-viewport.png` });
  await page.screenshot({ path: `${root}/day-without-forecast-mobile-full.png`, fullPage: true });
  const light = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Ativar tema escuro" }).click();
  await page.keyboard.press("Escape");
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  await page.screenshot({ path: `${root}/day-without-forecast-dark-mobile-viewport.png` });
  await page.screenshot({ path: `${root}/day-without-forecast-dark-mobile-full.png`, fullPage: true });
  const dark = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
  return { light, dark };
}
