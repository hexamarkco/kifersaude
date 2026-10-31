async page => {
  const button = page.getByRole("button", { name: "Abrir perfis e acessos" });
  await button.waitFor({ state: "visible" });
  await button.hover();
  await page.waitForTimeout(200);
  const data = await button.evaluate((element) => {
    const content = element.querySelector(".kds-card-padding-md");
    const title = content?.firstElementChild;
    const icon = content?.lastElementChild;
    const rect = (node) => node.getBoundingClientRect();
    return {
      viewport: innerWidth,
      buttonPadding: getComputedStyle(element).padding,
      contentPadding: content ? getComputedStyle(content).padding : null,
      labelInset: content && title ? Math.round(rect(title).left - rect(content).left) : null,
      iconInset: content && icon ? Math.round(rect(content).right - rect(icon).right) : null,
    };
  });
  await button.screenshot({ path: "output/playwright/settings-catalog-link-padding-after.png", animations: "disabled", caret: "hide" });
  return data;
}
