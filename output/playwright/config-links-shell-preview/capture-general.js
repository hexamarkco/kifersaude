async page => {
  await page.route("**/*", route =>
    route.request().url().startsWith("http://127.0.0.1:5182/")
      ? route.continue()
      : route.abort(),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.waitForLoadState("load");
  await page.getByRole("tab", { name: "Geral" }).click();
  const link = page.getByRole("button", { name: "Abrir perfis e acessos" });
  await link.waitFor({ state: "visible" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);

  const root = "kifersaude-ui-redesign/validacao/revisao-visual/config/";
  const captures = [];
  const capture = async (name, width, height, fullPage = true) => {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(200);
    const metrics = await page.evaluate(() => ({
      width: innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      pageHeight: document.documentElement.scrollHeight,
      headings: document.querySelectorAll("main h1").length,
    }));
    const overflow = metrics.scrollWidth > metrics.clientWidth;
    if (overflow) throw new Error(`Overflow horizontal em ${width}px`);
    await page.screenshot({ path: root + name, fullPage, animations: "disabled", caret: "hide" });
    captures.push({ name, ...metrics, horizontalOverflow: overflow });
  };

  await capture("shell-general-desktop-light-1920x1080.png", 1920, 1080, true);
  await capture("shell-general-desktop-light-viewport-1920x1080.png", 1920, 1080, false);
  await capture("shell-general-tablet-light-768x1024.png", 768, 1024, true);
  await capture("shell-general-tablet-light-viewport-768x1024.png", 768, 1024, false);
  await capture("shell-general-mobile-light-390x844.png", 390, 844, true);
  await capture("shell-general-mobile-light-viewport-390x844.png", 390, 844, false);
  await capture("shell-general-compact-light-320x640.png", 320, 640, true);
  await capture("shell-general-compact-light-viewport-320x640.png", 320, 640, false);

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByRole("button", { name: "Ativar tema escuro" }).first().click();
  await capture("shell-general-desktop-dark-1920x1080.png", 1920, 1080, true);
  await page.getByRole("button", { name: "Ativar tema claro" }).first().click();
  const padding = await link.evaluate((element) => {
    const content = element.querySelector(".kds-card-padding-md");
    const label = content?.firstElementChild;
    const icon = content?.lastElementChild;
    const rect = (node) => node.getBoundingClientRect();
    return {
      buttonPadding: getComputedStyle(element).padding,
      contentPadding: content ? getComputedStyle(content).padding : null,
      labelInset: content && label ? Math.round(rect(label).left - rect(content).left) : null,
      iconInset: content && icon ? Math.round(rect(content).right - rect(icon).right) : null,
    };
  });
  await link.hover();
  await page.waitForTimeout(180);
  await link.screenshot({ path: root + "settings-catalog-link-padding-hover.png", animations: "disabled", caret: "hide" });
  return { captures, padding };
}
