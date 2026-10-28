async page => await page.locator('[aria-label="Seções do lead"]').evaluate(el => ({
  listGap: getComputedStyle(el).gap,
  listClientWidth: el.clientWidth,
  listScrollWidth: el.scrollWidth,
  tabs: [...el.children].map(item => {
    const style = getComputedStyle(item);
    return { label: item.innerText, width: item.getBoundingClientRect().width, paddingLeft: style.paddingLeft, paddingRight: style.paddingRight, fontSize: style.fontSize, fontFamily: style.fontFamily };
  }),
}))
