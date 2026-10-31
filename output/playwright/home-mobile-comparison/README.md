# Comparação das 10 referências mobile

Abra `index.html` diretamente no navegador. A página funciona com arquivos locais e reúne as dez referências enviadas, as capturas atuais correspondentes e links para a página completa e a primeira tela.

- Larguras disponíveis: 320, 360, 375, **390**, 414 e 430 pixels CSS.
- Capturas reais da versão publicada em `https://www.kifersaude.com.br/`, feitas com WebKit e o perfil iPhone 12 Pro. A largura padrão é 390 px; as demais verificam o layout em outras larguras mobile. É emulação, sem captura de aparelho físico.
- Referência e captura usam a mesma largura de exibição, com altura automática. Não há corte nem esticamento para igualar as alturas.
- A captura 01 inclui o cabeçalho. As demais mostram somente a seção correspondente. Os perfis estão em Pessoa física, o FAQ está fechado e o formulário está vazio.
- As referências originais ficam em `references/`, sem edição. Dimensões e hashes SHA-256 estão em `references-metadata.json`.
- Os metadados de captura estão em `capture-metrics.json`. Cada pasta de largura contém dez seções, `page.png` e `viewport.png`.

As animações são reduzidas durante a captura. O cabeçalho é temporariamente colocado na posição natural da página, com as mesmas dimensões, para evitar artefatos de captura do cabeçalho fixo no WebKit. O link de pular conteúdo, que normalmente fica fora da tela, é ocultado apenas na captura. Não há mudança no código do site nem preenchimento ou envio de formulário; a rota de envio de leads é bloqueada no navegador de captura.

## Reproduzir

Na raiz do repositório, usando PowerShell, Node.js e Playwright CLI com WebKit instalado:

```powershell
npx --yes --package @playwright/cli playwright-cli -s=home-mobile-comparison open https://www.kifersaude.com.br/ --browser=webkit --device='iPhone 12 Pro'
$comparisonLog = Join-Path $env:TEMP 'kifer-mobile-comparison-capture.log'
npx --yes --package @playwright/cli playwright-cli -s=home-mobile-comparison run-code (Get-Content -Raw -LiteralPath 'output/playwright/home-mobile-comparison/capture.js') > $comparisonLog
$comparisonLines = Get-Content -LiteralPath $comparisonLog
if ($comparisonLines[0] -ne '### Result') { throw 'A captura falhou. Confira o log.' }
$comparisonLines[1] | ConvertFrom-Json | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath 'output/playwright/home-mobile-comparison/capture-metrics.json' -Encoding utf8
node output/playwright/home-mobile-comparison/build.mjs
npx --yes --package @playwright/cli playwright-cli -s=home-mobile-comparison close
```

`build.mjs` verifica os arquivos PNG e suas dimensões antes de gerar novamente o HTML.
