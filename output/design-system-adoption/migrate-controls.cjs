const fs=require('fs'),path=require('path'),ts=require('typescript');
const geometry=/^(?:(?:sm|md|lg|xl|2xl|hover|focus|focus-visible|active|disabled):)*!?(?:(?:min-|max-)?h-|(?:p|px|py|pl|pr|pt|pb)-|rounded(?:-|$)|text-(?:xs|sm|base|lg|xl|\[)|leading-(?:none|tight|snug|normal|relaxed|loose|\[)|gap-)/;
const visual=/^(?:(?:hover|focus|focus-visible|active|disabled):)*(?:bg-|border-(?![trblxy]$)|shadow|ring-)/;
function clean(value){return value.split(/\s+/).filter(v=>v&&!geometry.test(v)&&!visual.test(v)).join(' ');}
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const report=[];
for(const file of walk('src').filter(f=>f.endsWith('.tsx')&&!f.includes('__tests__')&&!f.includes('design-system')&&!f.endsWith('.test.tsx'))){
 let source=fs.readFileSync(file,'utf8');const sf=ts.createSourceFile(file,source,99,true,ts.ScriptKind.TSX);const edits=[],need=new Set();let count=0;
 const imported=new Map();for(const n of sf.statements)if(ts.isImportDeclaration(n)&&n.moduleSpecifier.text.match(/(?:^|\/)design-system$/)){const names=n.importClause?.namedBindings;if(names&&ts.isNamedImports(names))for(const e of names.elements)imported.set(e.propertyName?.text??e.name.text,e.name.text);}
 function add(start,end,value){edits.push({start,end,value});}
 function visit(n){
  if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){
   const tag=n.tagName.getText(sf),attrs=n.attributes.properties;let component=null,extra='';const attr=name=>attrs.find(p=>p.name?.text===name);const type=attr('type')?.initializer?.text;const cl=attr('className');const classText=cl?.initializer?.getText(sf)??'';
   if(tag==='input'){
    component=type==='file'?'FileInput':type==='range'?'Slider':type==='checkbox'?'Checkbox':type==='radio'?'Radio':'Input';
    if(['file','range','checkbox','radio'].includes(type)){const a=attr('type');add(a.getStart(sf),a.end,'');}
   }else if(tag==='textarea')component='Textarea';
   else if(tag==='button'){
    const children=ts.isJsxOpeningElement(n)?n.parent.children:[];const complex=children.some(c=>ts.isJsxElement(c)&&['div','section','article','figure','img','video','audio','p'].includes(c.openingElement.tagName.getText(sf)));
    const words=children.some(c=>ts.isJsxText(c)&&c.text.trim())||children.some(c=>ts.isJsxElement(c)&&['span','strong','small'].includes(c.openingElement.tagName.getText(sf)));
    if(classText.includes('kds-dropdown-option'))component='DropdownOption';
    else if(complex||/whatsapp|terracota|notification|message|media-|flow-|w-full|h-full|aspect|kds-op-status|sidebar|chat-/.test(classText)){component='ActionSurface';extra=' variant="plain" padding="none"';}
    else if(!words&&(attr('aria-label')||attr('aria-labelledby')||attr('title'))){component='IconButton';extra=' variant="ghost" size="sm"';if(!attr('aria-label')&&!attr('aria-labelledby'))extra+=' aria-label='+attr('title').initializer.getText(sf);}
    else {component='Button';extra=/danger|Trash/.test(n.parent.getText(sf))?' variant="destructive"':classText.includes('bg-[var(--brand-primary)]')?' variant="primary"':' variant="ghost"';}
   }
   if(component){
    const local=imported.get(component)??component;need.add(component);count++;add(n.tagName.getStart(sf),n.tagName.end,local+extra);
    if(ts.isJsxOpeningElement(n))add(n.parent.closingElement.tagName.getStart(sf),n.parent.closingElement.tagName.end,local);
    if(['Button','IconButton','Input','Textarea','Slider','Radio','Checkbox'].includes(component)&&cl){
     function cleanStrings(v){if(ts.isStringLiteral(v)||ts.isNoSubstitutionTemplateLiteral(v)){const text=clean(v.text);add(v.getStart(sf),v.end,JSON.stringify(text));}else ts.forEachChild(v,cleanStrings);}
     cleanStrings(cl.initializer);
    }
    if(['Button','IconButton'].includes(component)&&ts.isJsxOpeningElement(n)){
     function icons(v){if(ts.isJsxSelfClosingElement(v)&&/^[A-Z]/.test(v.tagName.getText(sf))){const a=v.attributes.properties.find(p=>p.name?.text==='className');if(a&&ts.isStringLiteral(a.initializer))add(a.initializer.getStart(sf),a.initializer.end,JSON.stringify(a.initializer.text.split(/\s+/).filter(v=>! /^(?:[a-z-]+:)*[wh]-/.test(v)).join(' ')));}ts.forEachChild(v,icons);}n.parent.children.forEach(icons);
    }
   }
  }ts.forEachChild(n,visit);
 }
 visit(sf);if(!count)continue;
 const missing=[...need].filter(n=>!imported.has(n));if(missing.length){const relative=path.relative(path.dirname(file),'src/design-system').split(path.sep).join('/');add(0,0,`import { ${missing.join(', ')} } from '${relative.startsWith('.')?relative:'./'+relative}';\n`);}
 edits.sort((a,b)=>b.start-a.start||b.end-a.end);for(const e of edits)source=source.slice(0,e.start)+e.value+source.slice(e.end);fs.writeFileSync(file,source);report.push({file,count,components:[...need]});
}
fs.writeFileSync('output/design-system-adoption/migration.json',JSON.stringify(report,null,2));console.log('Migrated',report.reduce((n,f)=>n+f.count,0),'controls across',report.length,'files');
