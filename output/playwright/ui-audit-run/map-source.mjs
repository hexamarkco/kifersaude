import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const root=process.cwd();const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){if(!['__tests__','design-system'].includes(e.name))walk(p);}else if(p.endsWith('.tsx')&&!p.includes(path.join('pages','dev')))files.push(p);}}
walk(path.join(root,'src'));
const interfaces=[],menus=[];
const tagPattern=/(Modal|Dialog|Drawer|Dropdown|Popover|Menu|Form|Details|DetailsPanel)$/;
for(const file of files){const text=fs.readFileSync(file,'utf8'),source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),relative=path.relative(root,file).replaceAll('\\','/');
 function visit(node){
  if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){
   const component=node.tagName.getText(source);
   if(tagPattern.test(component)||['Select','DateTimePicker','SegmentedControl','Tabs','Combobox'].includes(component)){
    interfaces.push({component,file:relative,line:source.getLineAndCharacterOfPosition(node.getStart(source)).line+1,status:'mapped',screenshots:[]});
   }
  }
  if(relative==='src/components/Layout.tsx'&&ts.isObjectLiteralExpression(node)){
   const value=key=>{const prop=node.properties.find(p=>ts.isPropertyAssignment(p)&&p.name?.getText(source)===key);return prop&&ts.isStringLiteral(prop.initializer)?prop.initializer.text:null;};
   if(value('id')&&value('label'))menus.push({id:value('id'),label:value('label')});
  }
  ts.forEachChild(node,visit);
 }visit(source);
}
const file='src/main.tsx',source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const routes=[];
function routeVisit(node,parent=''){
 if(ts.isJsxElement(node)||ts.isJsxSelfClosingElement(node)){
  const opening=ts.isJsxElement(node)?node.openingElement:node;
  if(opening.tagName.getText(source)==='Route'){
   const get=key=>{const attr=opening.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText(source)===key);return attr?.initializer&&ts.isStringLiteral(attr.initializer)?attr.initializer.text:null;};
   const part=get('path');const full=part?(part.startsWith('/')?part:parent&&parent!=='*'?parent.replace(/\/$/,'')+'/'+part:part):parent;
   const attr=opening.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText(source)==='element');let components=[];
   if(attr){const collect=n=>{if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n))components.push(n.tagName.getText(source));ts.forEachChild(n,collect);};collect(attr);}
   routes.push({pattern:full||'/',index:opening.attributes.properties.some(p=>ts.isJsxAttribute(p)&&p.name.getText(source)==='index'),components:[...new Set(components)],redirect:!!(attr?.initializer && ts.isJsxExpression(attr.initializer) && attr.initializer.expression && (ts.isJsxSelfClosingElement(attr.initializer.expression)||ts.isJsxElement(attr.initializer.expression)) && (ts.isJsxSelfClosingElement(attr.initializer.expression)?attr.initializer.expression.tagName:attr.initializer.expression.openingElement.tagName).getText(source)==='Navigate'),line:source.getLineAndCharacterOfPosition(opening.getStart(source)).line+1});
   if(attr)routeVisit(attr,full);
   if(ts.isJsxElement(node))for(const child of node.children)routeVisit(child,full);
   return;
  }
 }
 ts.forEachChild(node,child=>routeVisit(child,parent));
}routeVisit(source);
const result={generated_at:'2026-10-25',route_source:file,routes,menu_source:'src/components/Layout.tsx',menu_items:menus.filter((item,i,arr)=>arr.findIndex(x=>x.id===item.id&&x.label===item.label)===i),interfaces};
fs.writeFileSync('docs/ui-audit/source-map.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({routes:routes.length,interfaces:interfaces.length,menus:result.menu_items.length}));
