import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'supabase/functions/_shared/comm-whatsapp/zapi-operation-contract.ts');
const destination = resolve(root, 'src/features/communication/whatsapp/domain/zapiOperationContract.generated.ts');
const expected = '// Generated; edit the server contract and run npm run types:zapi.\n' + readFileSync(source, 'utf8');
if (process.argv.includes('--check')) {
  if (readFileSync(destination, 'utf8') !== expected) {
    throw new Error('Contrato Z-API desatualizado. Execute npm run types:zapi.');
  }
  console.log('Contrato Z-API do browser confere com o servidor.');
} else {
  writeFileSync(destination, expected);
}
