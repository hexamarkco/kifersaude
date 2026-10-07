import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Only the sandbox scenario endpoint is invoked. It persists simulated
// conversations and never calls the WhatsApp send endpoint.
const phase = process.argv[2];
if (!['baseline', 'candidate'].includes(phase)) throw new Error('Use baseline or candidate.');
const project = 'eaxvvhamkmovkoqssahj';
const rawKeys = execFileSync('supabase', ['projects', 'api-keys', '--project-ref', project, '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const keys = JSON.parse(rawKeys);
const serviceKey = keys.find((key) => key.name === 'service_role')?.api_key;
if (!serviceKey) throw new Error('Service credential unavailable; no sandbox requests sent.');
const scenarios = [
  { key: 'objective', first: 'Boa noite, só para mim.', persona: 'Você é Marina, 34 anos, mora no Rio de Janeiro, Tijuca, não tem CNPJ/MEI e está sem cobertura. Responda somente o dado perguntado, com respostas curtas. Não invente objeções. Se receber o compromisso de envio da cotação, agradeça.' },
  { key: 'budget', first: 'Boa noite, quero um plano para mim, mas estou preocupada com o valor.', persona: 'Você é Marina, 34 anos, Rio de Janeiro, Tijuca, sem CNPJ/MEI e sem plano. Está preocupada com o orçamento. Responda só o dado perguntado, sem inventar outras objeções. Ao receber o compromisso de cotação, agradeça.' },
];
const results = [];
for (let repetition = 1; repetition <= (phase === 'baseline' ? 1 : 3); repetition += 1) {
for (const scenario of scenarios.slice(0, phase === 'baseline' ? 1 : 2)) {
  const response = await fetch(`https://${project}.supabase.co/functions/v1/ai-sandbox-run-scenario`, {
    method: 'POST', headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioKey: `tone-structure-${phase}-${scenario.key}`, scenarioLabel: `Tone structure ${phase} ${scenario.key}`, leadName: 'Marina', leadPersonaPrompt: scenario.persona, startMode: 'lead_opens', firstLeadMessage: scenario.first, maxTurns: 8 }),
    signal: AbortSignal.timeout(180000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`Sandbox HTTP ${response.status}: ${JSON.stringify(result)}`);
  results.push({ repetition, scenario: scenario.key, ...result });
  console.log(JSON.stringify({ phase, repetition, scenario: scenario.key, conversationId: result.conversationId, passed: result.passed, violations: result.violations }));
}
}
const dir = path.resolve('docs/evaluations');
await mkdir(dir, { recursive: true });
await writeFile(path.join(dir, `autonomous-tone-${phase}.json`), `${JSON.stringify(results, null, 2)}\n`);
