async (page) => {
  const root = "C:/Users/Nick Martins/Documents/GitHub/kifersaude/kifersaude-ui-redesign/validacao/revisao-visual/commissions";
  const viewports = [
    ["desktop", 1920, 1080],
    ["tablet", 768, 1024],
    ["mobile", 390, 844],
    ["mobile-320", 320, 640],
  ];
  await page.getByRole("button", { name: /^28/ }).click();
  const result = {};
  for (const [name, width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${root}/${name}/calendar-dark-viewport.png` });
    await page.screenshot({ path: `${root}/${name}/calendar-dark-full.png`, fullPage: true });
    result[name] = await page.evaluate(() => ({
      width: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    }));
  }
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Ativar tema claro" }).click();
  await page.keyboard.press("Escape");
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  for (const [name, width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${root}/${name}/calendar-viewport.png` });
    await page.screenshot({ path: `${root}/${name}/calendar-full.png`, fullPage: true });
  }
  return result;
}
