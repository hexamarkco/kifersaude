async (page) => {
  await page.getByRole('button', { name: 'Criar versão e ativar' }).click();
  return await page.evaluate(() => [...document.querySelectorAll('[class*="toast"]')].map(el => ({tag:el.tagName,cls:el.className,rect:el.getBoundingClientRect().toJSON(),bottom:getComputedStyle(el).bottom,position:getComputedStyle(el).position,style:el.getAttribute('style')})));
}
