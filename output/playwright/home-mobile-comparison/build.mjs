import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('./', import.meta.url);
const metrics = JSON.parse((await readFile(new URL('capture-metrics.json', root), 'utf8')).replace(/^\uFEFF/, ''));
const widths = [320,360,375,390,414,430];
const entries = [
  ['01','topo','HERO_ABERTURA','Hero / abertura'],
  ['02','prova-social','CONFIANCA_OPERADORAS','Confiança e operadoras'],
  ['03','para-quem','PARA_QUEM_E','Para quem é'],
  ['04','como-funciona','COMO_FUNCIONA','Como funciona'],
  ['05','depoimentos','DEPOIMENTOS','Depoimentos'],
  ['06','quem-somos','SOBRE_LUIZA','Sobre a Luíza'],
  ['07','faq','DUVIDAS_FREQUENTES','Dúvidas frequentes'],
  ['08','cotacao','COTACAO','Cotação'],
  ['09','fale-agora','WHATSAPP','WhatsApp'],
  ['10','rodape','RODAPE','Rodapé'],
];
const dimensions = async file => {
  const buffer = await readFile(new URL(file, root));
  if (buffer.subarray(1,4).toString() !== 'PNG') throw new Error(`Expected PNG: ${file}`);
  return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20),sha256:createHash('sha256').update(buffer).digest('hex')};
};
const records = [];
for (const [number,id,reference,title] of entries) {
  const referenceFile = `references/${number}_${reference}_MOBILE.png`;
  const record = {number,id,title,reference:{file:referenceFile,...await dimensions(referenceFile)},captures:{}};
  for (const width of widths) {
    const file = `${width}/${number}-${id}.png`;
    record.captures[width] = {file,...await dimensions(file)};
    if (record.captures[width].width !== width) throw new Error(`Invalid width: ${file}`);
  }
  records.push(record);
}
for (const width of widths) {
  await dimensions(`${width}/page.png`);
  await dimensions(`${width}/viewport.png`);
}
const date = new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(metrics.capturedAt));
const figures = records.map(record => {
  const capture = record.captures[390];
  return `<section id="secao-${record.number}" aria-labelledby="titulo-${record.number}">
  <h2 id="titulo-${record.number}">${record.number} — ${record.title}</h2>
  <div class="comparison">
    <figure><figcaption><strong>Referência fornecida</strong><span>${record.reference.width} × ${record.reference.height} px · imagem original</span></figcaption>
      <a class="image-link reference-link" href="${record.reference.file}" target="_blank" rel="noopener" aria-label="Abrir referência original — ${record.title}"><img src="${record.reference.file}" width="${record.reference.width}" height="${record.reference.height}" alt="Referência mobile fornecida — ${record.title}" loading="lazy"></a>
    </figure>
    <figure><figcaption><strong>Implementação atual</strong><span data-dimensions="${record.number}">${capture.width} × ${capture.height} px · WebKit</span></figcaption>
      <a class="image-link capture-link" data-capture="${record.number}" href="${capture.file}" target="_blank" rel="noopener" aria-label="Abrir captura original — ${record.title}"><img src="${capture.file}" width="${capture.width}" height="${capture.height}" alt="Captura real do site em 390 px — ${record.title}" loading="lazy"></a>
    </figure>
  </div>
</section>`;
}).join('\n');
const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="data:,">
<title>Kifer Saúde — comparação das 10 referências mobile</title>
<style>
  :root{--capture-width:390px;color-scheme:light}
  *{box-sizing:border-box}
  body{margin:0;background:#faf8f5;color:#251c17;font:16px/1.6 system-ui,sans-serif}
  main{max-width:1200px;margin:auto;padding:36px 24px}
  h1{font:500 clamp(28px,4vw,48px)/1.2 Georgia,serif;margin:0 0 16px;max-width:850px}
  h2{font:500 clamp(24px,3vw,30px)/1.25 Georgia,serif;margin:32px 0 20px}
  p{max-width:950px;color:#635950}
  a{color:#a83d17;text-underline-offset:4px}
  a:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid #c94c21;outline-offset:4px}
  .controls{position:sticky;top:0;z-index:1;display:flex;align-items:center;gap:16px 24px;flex-wrap:wrap;background:#faf8f5;border-block:1px solid #e9e3da;padding:16px 0;margin:24px 0 0}
  .control{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  label{font-weight:600}
  select{font:inherit;padding:10px 12px;border:1px solid #d9d0c7;border-radius:8px;background:#fff;color:inherit;max-width:100%;min-height:44px}
  .capture-summary{flex-basis:100%;font-size:13px;color:#635950}
  section{scroll-margin-top:170px}
  .comparison{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;margin-bottom:48px;align-items:start}
  figure{margin:0;min-width:0;background:#fff;border:1px solid #e9e3da;border-radius:12px;padding:16px}
  figcaption{display:flex;flex-direction:column;gap:3px;font-size:13px;color:#635950;margin-bottom:16px}
  figcaption strong{color:#251c17;font-size:15px}
  .image-link{display:block;width:var(--capture-width);max-width:100%;margin-inline:auto}
  img{display:block;width:100%;height:auto;max-height:none}
  .note{padding:16px 20px;border-left:3px solid #c94c21;background:#fff1ea;max-width:1000px}
  .note p{margin-bottom:0}
  summary{cursor:pointer;font-weight:600}
  .meta{font-size:13px}
  footer{border-top:1px solid #e9e3da;padding-top:20px;margin-top:16px}
  @media(max-width:700px){main{padding:24px 16px}.comparison{grid-template-columns:1fr}.controls{position:static;gap:16px}.control{width:100%;justify-content:space-between}.control select{max-width:65%}section{scroll-margin-top:20px}figure{padding:12px}}
</style>
</head>
<body>
<main>
<h1>Dez referências mobile, lado a lado com o site.</h1>
<p>Comparação das dez imagens fornecidas com capturas reais da versão publicada da Kifer Saúde. Referência à esquerda e implementação à direita, com a mesma largura de exibição e proporções preservadas. Clique em qualquer imagem para abrir o arquivo original.</p>
<p class="meta">Capturas de <time datetime="${metrics.capturedAt}">${date}</time> · WebKit · largura inicial de 390 px, correspondente ao perfil iPhone 12 Pro · <a href="${metrics.source}" target="_blank" rel="noopener">Site capturado</a> · <a href="../home-redesign/index.html">Comparação desktop</a></p>
<details class="note"><summary>Sobre diferenças de conteúdo</summary><p>As fotos da Luíza foram atualizadas com sua aprovação. A implementação exibe as cinco operadoras do projeto, os contatos reais e a área reservada aos depoimentos até haver relatos autorizados. O formulário mantém os campos e a integração reais.</p></details>
<div class="controls" aria-label="Controles da comparação">
  <div class="control"><label for="width">Largura da captura</label><select id="width">${widths.map(width=>`<option value="${width}"${width===390?' selected':''}>${width} px</option>`).join('')}</select></div>
  <div class="control"><label for="section">Ir para seção</label><select id="section"><option value="">Escolher seção</option>${records.map(record=>`<option value="secao-${record.number}">${record.number} — ${record.title}</option>`).join('')}</select></div>
  <a id="full" href="390/page.png" target="_blank" rel="noopener">Página completa</a>
  <a id="viewport" href="390/viewport.png" target="_blank" rel="noopener">Primeira tela</a>
  <span id="capture-summary" class="capture-summary" aria-live="polite">10 referências · 10 capturas em 390 px. A abertura inclui o cabeçalho.</span>
</div>
${figures}
<footer><p>As capturas mostram os perfis no estado inicial, o FAQ fechado e o formulário sem preenchimento. As imagens mantêm a proporção original; diferenças de altura entre referência e captura continuam visíveis.</p><p><a href="../../../docs/homepage-iphone-2026-10-31.md">Relatório dos ajustes para iPhone</a> · <a href="README.md">Como reproduzir estas capturas</a></p></footer>
</main>
<script>
const entries=${JSON.stringify(records)};
const widthSelect=document.getElementById('width');
function update(){
  const width=Number(widthSelect.value);
  document.documentElement.style.setProperty('--capture-width',width+'px');
  for(const entry of entries){
    const capture=entry.captures[width];
    const link=document.querySelector('[data-capture="'+entry.number+'"]');
    const image=link.querySelector('img');
    image.width=capture.width;image.height=capture.height;
    image.src=capture.file;image.alt='Captura real do site em '+width+' px — '+entry.title;
    link.href=capture.file;
    document.querySelector('[data-dimensions="'+entry.number+'"]').textContent=capture.width+' × '+capture.height+' px · WebKit';
  }
  document.getElementById('full').href=width+'/page.png';
  document.getElementById('viewport').href=width+'/viewport.png';
  document.getElementById('capture-summary').textContent='10 referências · 10 capturas em '+width+' px. A abertura inclui o cabeçalho.';
}
widthSelect.addEventListener('change',update);
document.getElementById('section').addEventListener('change',event=>{
  if(event.target.value) document.getElementById(event.target.value).scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
});
</script>
</body>
</html>
`;
await writeFile(new URL('index.html',root),html);
await writeFile(new URL('references-metadata.json',root),JSON.stringify(records.map(({number,reference})=>({number,...reference})),null,2)+'\n');
console.log(`Comparison built: ${records.length} references, ${widths.length} mobile widths.`);
