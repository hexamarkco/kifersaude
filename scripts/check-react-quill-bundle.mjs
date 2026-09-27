import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const assetsDirectory = path.resolve(scriptDirectory, '..', 'dist', 'assets');

if (!fs.existsSync(assetsDirectory)) {
  throw new Error('O diretório dist/assets não existe. Execute o build antes desta verificação.');
}

const javascriptFiles = fs
  .readdirSync(assetsDirectory)
  .filter((fileName) => fileName.endsWith('.js'));

const editorChunks = javascriptFiles
  .map((fileName) => ({
    fileName,
    source: fs.readFileSync(path.join(assetsDirectory, fileName), 'utf8'),
  }))
  .filter(({ source }) => source.includes('React Quill'));

if (editorChunks.length === 0) {
  throw new Error('O bundle do editor ReactQuill não foi encontrado em dist/assets.');
}

for (const { fileName, source } of editorChunks) {
  if (!source.includes('__esModule')) {
    throw new Error(`O bundle ${fileName} não contém a ponte ESM/CJS do ReactQuill.`);
  }

  if (source.includes('default.default')) {
    throw new Error(
      `O bundle ${fileName} contém um namespace React aninhado (default.default), ` +
        'que causa Component/findDOMNode indefinido em produção.',
    );
  }
}

console.log(`Bundle do editor verificado: ${editorChunks.map(({ fileName }) => fileName).join(', ')}`);
