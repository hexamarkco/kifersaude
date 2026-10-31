async page => {
  await page.route("**/*", route =>
    route.request().url().startsWith("http://127.0.0.1:5182/")
      ? route.continue()
      : route.abort(),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.waitForLoadState("load");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);

  const root = "kifersaude-ui-redesign/validacao/revisao-visual/config-links/";
  const captures = [];
  const capture = async (name, width, height, fullPage = true) => {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(250);
    const metrics = await page.evaluate(() => ({
      width: innerWidth,
      clientWidth: document.documentElement.clientWidth,
      height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      pageHeight: document.documentElement.scrollHeight,
      headings: document.querySelectorAll("main h1").length,
    }));
    if (metrics.scrollWidth > metrics.clientWidth) throw new Error(`Overflow em ${width}: ${metrics.scrollWidth} > ${metrics.clientWidth}`);
    await page.screenshot({ path: root + name, fullPage, animations: "disabled", caret: "hide" });
    captures.push({ name, ...metrics });
  };

  await capture("shell-desktop-light-1920x1080.png", 1920, 1080, true);
  await capture("shell-desktop-light-viewport-1920x1080.png", 1920, 1080, false);
  await capture("shell-tablet-light-768x1024.png", 768, 1024, true);
  await capture("shell-tablet-light-viewport-768x1024.png", 768, 1024, false);
  await capture("shell-mobile-light-390x844.png", 390, 844, true);
  await capture("shell-mobile-light-viewport-390x844.png", 390, 844, false);
  await capture("shell-compact-light-320x640.png", 320, 640, true);
  await capture("shell-compact-light-viewport-320x640.png", 320, 640, false);

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByRole("button", { name: "Ativar tema escuro" }).first().click();
  await page.waitForTimeout(250);
  await capture("shell-desktop-dark-1920x1080.png", 1920, 1080, true);
  await page.getByRole("button", { name: "Ativar tema claro" }).first().click();
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "Novo link" }).click();
  await page.getByRole("dialog").waitFor({ state: "visible" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: root + "shell-desktop-create-dialog-1920x1080.png", fullPage: true, animations: "disabled", caret: "hide" });
  return captures;
}
