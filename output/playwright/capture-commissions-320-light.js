async (page) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addStyleTag({ content: "*,*::before,*::after{animation-duration:0.001ms!important;transition-duration:0.001ms!important;scroll-behavior:auto!important}" });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.getByRole("button", { name: /^28/ }).click();
  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollTo(0, 0));
  const root = "C:/Users/Nick Martins/Documents/GitHub/kifersaude/kifersaude-ui-redesign/validacao/revisao-visual/commissions/mobile-320";
  await page.screenshot({ path: `${root}/calendar-viewport.png` });
  await page.screenshot({ path: `${root}/calendar-full.png`, fullPage: true });
  return await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, theme: document.querySelector(".theme-dark") ? "dark" : "light" }));
}
