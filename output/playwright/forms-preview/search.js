async (page) => {
 const cards=page.locator('.kds-collection-cards');
 return {matched:await cards.getByText('Solicitação de contato').count(),excluded:await cards.getByText('Cotação inicial').count(),value:await page.getByRole('textbox',{name:'Buscar formulários'}).inputValue()};
}
