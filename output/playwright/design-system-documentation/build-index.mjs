import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const work='output/playwright/design-system-documentation/';
const root='docs/design-system/screenshots/';
const records=[]; const failures=[];
for(const batch of ['pages','controls','overlays','extras']) for(const device of ['desktop','tablet','mobile']){
 const log=fs.readFileSync(work+batch+'-'+device+'.log','utf8');
 if(!log.includes('### Result')) throw new Error('Incomplete batch: '+batch+'-'+device);
 const data=JSON.parse(log.split('### Result')[1].split('### Ran Playwright code')[0].trim());
 records.push(...data.records);failures.push(...data.failures);
}
const unique=new Map(records.map(record=>[record.file,record]));
if(unique.size!==records.length) throw new Error('Duplicate filenames');
const table=new Uint32Array(256);
for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[n]=c;}
function crc(buffer){let c=0xffffffff;for(const byte of buffer)c=table[(c^byte)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
for(const record of records){
 const buffer=fs.readFileSync(root+record.file);
 if(buffer.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error('Invalid PNG '+record.file);
 let end=false;
 for(let offset=8;offset<buffer.length;){
  const length=buffer.readUInt32BE(offset);const next=offset+length+12;
  if(next>buffer.length)throw new Error('Truncated PNG '+record.file);
  if(crc(buffer.subarray(offset+4,offset+8+length))!==buffer.readUInt32BE(offset+8+length))throw new Error('PNG CRC failed '+record.file);
  if(buffer.toString('ascii',offset+4,offset+8)==='IEND')end=true;
  offset=next;
 }
 if(!end)throw new Error('PNG missing IEND '+record.file);
 record.pixels={width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};
 record.bytes=buffer.length;record.sha256=crypto.createHash('sha256').update(buffer).digest('hex');
 if(record.capture==='viewport'&&(record.pixels.width!==record.viewport.width||record.pixels.height!==record.viewport.height))throw new Error('Viewport mismatch '+record.file);
}
function files(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(directory,entry.name)):[path.join(directory,entry.name)]);}
const pngFiles=files(root).filter(file=>file.endsWith('.png'));
const extras=pngFiles.filter(file=>!unique.has(path.relative(root,file).split(path.sep).join('/')));
if(extras.length)throw new Error('Unindexed screenshots: '+extras.join(','));
const baseline=JSON.parse(fs.readFileSync(work+'app-source-baseline.json','utf8'));
const changed=Object.entries(baseline).filter(([file,hash])=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==hash).map(([file])=>file);
if(changed.length)throw new Error('Application source changed: '+changed.join(','));
const manifest={source:'https://www.kifersaude.com.br/design-system',sourceCommit:'bbda9a0dc1c2c09da0452e796e2b77e85755ef2f',deployment:'https://vercel.com/hexabuilds/kifersaude/32gaivWLPLUGbwaMrr8sC5DJr6yd',capturedOn:'2026-10-24',timezone:'America/Sao_Paulo',tool:'Playwright CLI / Chromium',total:records.length,fullPage:records.filter(r=>r.capture==='fullPage').length,viewport:records.filter(r=>r.capture==='viewport').length,totalBytes:records.reduce((sum,r)=>sum+r.bytes,0),sourceFilesVerified:Object.keys(baseline).length,sourceFilesChanged:changed,failures,records};
fs.writeFileSync(root+'manifest.json',JSON.stringify(manifest,null,2)+'\n');
const deviceName={desktop:'Desktop',tablet:'Tablet',mobile:'Mobile'};
const lines=[
 '# Registro visual do design system — Kifer Saúde','',
 'Capturas da **versão revisada publicada**, em [www.kifersaude.com.br/design-system](https://www.kifersaude.com.br/design-system), feitas em **24/10/2026** (America/Sao_Paulo).',
 '',
 '- Commit de referência: [`bbda9a0d`](https://github.com/hexamarkco/kifersaude/commit/bbda9a0dc1c2c09da0452e796e2b77e85755ef2f).',
 '- Publicação confirmada: [Vercel](https://vercel.com/hexabuilds/kifersaude/32gaivWLPLUGbwaMrr8sC5DJr6yd).',
 '- A versão antiga, observada antes da conclusão da publicação, **não integra este conjunto de imagens**.',
 '- '+manifest.total+' PNGs: '+manifest.fullPage+' capturas `fullPage: true` e '+manifest.viewport+' capturas complementares de viewport. Aproximadamente '+(manifest.totalBytes/1024/1024).toFixed(1)+' MiB.',
 '- Autenticação não foi necessária. Os contatos e documentos mostrados são os dados fictícios do showcase.',
 '',
 '## Resoluções','',
 '| Pasta | Viewport configurado | Temas |','| --- | --- | --- |',
 '| `desktop/` | 1920 × 1080 | Claro e escuro |',
 '| `tablet/` | 768 × 1024 | Claro e escuro |',
 '| `mobile/` | 390 × 844 | Claro e escuro |','',
 '## Como usar','',
 'Cada imagem sem o sufixo `-viewport` captura **toda a página do estado correspondente**, sem recorte manual. O sufixo `-viewport` oferece uma segunda imagem na resolução exata do dispositivo, para ler o componente aberto e sua posição real na janela. Não substitui a imagem completa.',
 '',
 'O showcase troca as seções e categorias por navegação. Por isso, o registro completo é formado pelas capturas de todas as seções e das seis abas de componentes; uma única imagem da visão geral não contém a biblioteca inteira.',
 '',
 'As prévias de listagem, detalhes, criação, edição e dashboard também foram abertas como páginas independentes. Isso registra seu conteúdo completo, além da área visível dos iframes presentes no catálogo.',
 '',
 'Os estados interativos estão integralmente documentados no tema claro. O tema escuro inclui todas as seções, categorias e páginas, além de exemplos abertos de select, modal e popover.',
 '',
 '## Método e observações','',
 '- Playwright, com espera por carregamento de navegação, `document.fonts.ready`, imagens e documentos dos iframes. Animações desativadas apenas pela opção de screenshot; movimento reduzido emulado; cursor de texto ocultado na captura.',
 '- Nenhum CSS foi injetado e nenhum arquivo de código, componente ou estilo da aplicação foi alterado. Foram conferidos hashes de '+manifest.sourceFilesVerified+' arquivos de `src`, sem diferenças.',
 '- Um redesenho do viewport, voltando imediatamente à resolução solicitada antes da captura, evitou camadas visuais residuais do Chromium. Não há redimensionamento ou edição posterior dos PNGs.',
 '- `fullPage` mantém a extensão natural do documento. A largura do PNG pode diferir da largura configurada por causa da barra de rolagem nativa ou de conteúdo que ultrapassa o viewport. Os arquivos `-viewport` têm exatamente as dimensões solicitadas.',
 '- O conteúdo publicado ultrapassa a largura disponível em algumas capturas mobile/tablet. A área excedente foi preservada nas imagens completas para futura análise, sem corrigir os estilos.',
 '- Barras laterais, elementos fixos e popups conservam sua relação com a rolagem ativa nas capturas completas. Use a imagem de viewport para avaliar sua composição em contexto.',
 '- Modais ou drawers com rolagem interna possuem imagens de continuação quando essa rolagem foi detectada. As páginas de formulário independentes complementam a leitura integral dos campos.',
 '- Os exemplos de skeleton, loading, erro e vazio são estados intencionais da biblioteca. Os carregamentos transitórios foram acionados localmente para documentação; não representam falhas de carregamento do site.',
 '- Somente demonstrações locais foram preenchidas ou acionadas. Nenhuma comunicação comercial foi enviada e nenhum registro real do CRM foi alterado.',
 '- PNGs verificados por assinatura, estrutura, CRC de todos os blocos, dimensões e hash SHA-256. Metadados individuais: [manifest.json](manifest.json).','',
 '## Índice de capturas','',
 'Em cada célula, **Completa** abre a captura fullPage e **Viewport** abre a composição complementar, quando existente. “—” indica um estado não aplicável àquela resolução, como a navegação recolhida no desktop.',''
];
for(const theme of ['light','dark']){
 lines.push('### Tema '+(theme==='light'?'claro':'escuro'),'');
 const themed=records.filter(r=>r.theme===theme&&r.capture==='fullPage');
 const groups=[...new Set(themed.map(r=>r.group))];
 for(const group of groups){
  lines.push('#### '+group,'','| Seção, componente ou estado | Desktop | Tablet | Mobile |','| --- | --- | --- | --- |');
  const names=[...new Set(themed.filter(r=>r.group===group).map(r=>path.basename(r.file)))].sort();
  for(const name of names){
   const entry=themed.find(r=>r.group===group&&path.basename(r.file)===name);
   const cells=['desktop','tablet','mobile'].map(device=>{
    const file=device+'/'+theme+'/'+name;const full=unique.get(file);
    if(!full)return '—';
    let text='[Completa]('+file+')';
    const vpFile=file.replace('.png','-viewport.png');
    if(unique.has(vpFile))text+=' · [Viewport]('+vpFile+')';
    return text;
   });
   lines.push('| '+entry.label.replaceAll('|','/')+' | '+cells.join(' | ')+' |');
  }
  lines.push('');
 }
}
lines.push('## Verificação final','','- '+records.length+' imagens indexadas; nenhum PNG sem referência.','- '+failures.length+' erros de execução registrados nos lotes finais.','- Nenhum arquivo em `src` alterado durante a documentação.','');
fs.writeFileSync(root+'README.md',lines.join('\n'));
console.log(JSON.stringify({total:manifest.total,fullPage:manifest.fullPage,viewport:manifest.viewport,MiB:(manifest.totalBytes/1024/1024).toFixed(1),failures,sourceFilesChanged:changed}));
