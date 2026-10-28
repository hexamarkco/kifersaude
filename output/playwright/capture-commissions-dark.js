async (page) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addStyleTag({ content: "*,*::before,*::after{animation-duration:0.001ms!important;transition-duration:0.001ms!important;scroll-behavior:auto!important}" });
  await page.getByRole("button", { name: "Abrir menu" }).click();
  const dialog = page.getByRole("dialog", { name: "Navegação completa" });
  const darkAction = dialog.getByRole("button", { name: "Ativar tema escuro" });
  if (await darkAction.count()) await darkAction.click();
  const close = dialog.getByRole("button", { name: "Fechar menu" });
  if (await close.count()) await close.last().click();
  await dialog.waitFor({ state: "hidden" });
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  await page.evaluate(() => document.fonts.ready);
  const root = "C:/Users/Nick Martins/Documents/GitHub/kifersaude/kifersaude-ui-redesign/validacao/revisao-visual/commissions";
  const viewports = [["desktop", 1920, 1080], ["tablet", 768, 1024], ["mobile", 390, 844], ["mobile-320", 320, 640]];
  const result = {};
  for (const [name, width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${root}/${name}/calendar-dark-viewport.png` });
    await page.screenshot({ path: `${root}/${name}/calendar-dark-full.png`, fullPage: true });
    result[name] = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
  }
  return result;
}
