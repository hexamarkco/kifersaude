const fs=require('fs'),ts=require('typescript'),path=require('path');
const report=[];
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
for(const file of walk('src').filter(f=>f.endsWith('.tsx')&&!f.includes('__tests__')&&!f.includes('design-system')&&!f.endsWith('.test.tsx'))){
 let s=fs.readFileSync(file,'utf8');const sf=ts.createSourceFile(file,s,99,true,4),edits=[],need=new Map(),existing=new Map(),bindings=new Set();let count=0;
 for(const n of sf.statements)if(ts.isImportDeclaration(n)){const names=n.importClause?.namedBindings;if(n.importClause?.name)bindings.add(n.importClause.name.text);if(names&&ts.isNamedImports(names))for(const e of names.elements){bindings.add(e.name.text);if(/(?:^|\/)design-system$/.test(n.moduleSpecifier.text))existing.set(e.propertyName?.text??e.name.text,e.name.text);}}
 function add(a,b,v){edits.push({a,b,v});}
 function visit(n){if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){
  const tag=n.tagName.getText(sf),attrs=n.attributes.properties;let component,extra='';const cl=attrs.find(p=>p.name?.text==='className');
  if(tag==='p')component='Text';else if(/^h[1-6]$/.test(tag)){component='Heading';extra=` level={${tag[1]}}`;}
  else if(tag==='label')component='FieldLabel';else if(tag==='img')component='Image';else if(tag==='video')component='Video';else if(tag==='audio')component='Audio';else if(tag==='a')component='TextLink';
  if(component){const local=existing.get(component)??need.get(component)??(bindings.has(component)?'Ds'+component:component);need.set(component,local);add(n.tagName.getStart(sf),n.tagName.end,local+extra);if(ts.isJsxOpeningElement(n))add(n.parent.closingElement.tagName.getStart(sf),n.parent.closingElement.tagName.end,local);count++;}
  if(n.tagName.getText(sf)==='IconButton'&&cl&&ts.isStringLiteral(cl.initializer)){const value=cl.initializer.text.split(/\s+/).filter(v=>! /^(?:(?:sm|md|lg|xl|2xl):)?!?(?:min-|max-)?w-/.test(v)).join(' ');if(value!==cl.initializer.text)add(cl.initializer.getStart(sf),cl.initializer.end,JSON.stringify(value));}
 }ts.forEachChild(n,visit);}visit(sf);
 if(!edits.length)continue;const missing=[...need.entries()].filter(([n])=>!existing.has(n));if(missing.length){let rel=path.relative(path.dirname(file),'src/design-system').split(path.sep).join('/');if(!rel.startsWith('.'))rel='./'+rel;add(0,0,`import { ${missing.map(([n,l])=>n===l?n:n+' as '+l).join(', ')} } from '${rel}';\n`);}
 edits.sort((a,b)=>b.a-a.a||b.b-a.b);for(const e of edits)s=s.slice(0,e.a)+e.v+s.slice(e.b);fs.writeFileSync(file,s);report.push({file,count});
}
fs.writeFileSync('output/design-system-adoption/presentation-migration.json',JSON.stringify(report,null,2));console.log(report.reduce((n,r)=>n+r.count,0),'presentation elements migrated across',report.length,'files');
