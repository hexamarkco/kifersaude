# Kifer Saúde — guia para agentes

CRM e operação comercial da Kifer Saúde, com frontend React/Vite e backend Supabase (Postgres, Auth, Realtime, Storage e Edge Functions). Preserve comportamento comercial, contratos HTTP e banco; este sistema envia comunicações reais quando executado fora de testes.

## Mapa arquitetural

- `src/features/<dominio>`: unidade principal de mudança. Use `components` para UI, `hooks` para coordenação React, `domain`/`shared` para regras puras e `data` para Supabase/APIs.
- `src/infrastructure/supabase`: cliente, sessão, erros, paginação e tipos persistidos gerados. `database.generated.ts` é gerado; não editar manualmente.
- `src/design-system`: componentes e tokens visuais. `styles.css` é o único entrypoint CSS; detalhes ficam em `foundation.css`, `components.css`, `operational.css` e `themes.css`.
- `src/components` e `src/lib`: compatibilidade e utilidades multidomínio ainda em migração. Não adicionar lógica específica de feature nesses diretórios.
- `supabase/functions/<funcao>`: entrypoint HTTP e módulos locais. Código realmente comum entre functions fica em `supabase/functions/_shared`.
- `supabase/migrations`: histórico imutável do banco. Toda mudança nova usa uma nova migration.

Fluxo obrigatório: UI → hook/controlador → domínio → repository/service → Supabase/API. Componentes não importam o cliente Supabase. Entre features, importe somente a API pública (`index.ts`); não faça deep import em outra feature. `shared` não é depósito genérico.

Domínios principais: leads, contratos, agenda/lembretes, dashboard, configurações/IA/automações, conteúdo público, WhatsApp/inbox e campanhas. Regras operacionais não óbvias estão em [docs/domain-invariants.md](docs/domain-invariants.md). A visão de dependências está em [docs/architecture.md](docs/architecture.md).

## Convenções de implementação

- Antes de alterar uma feature, leia seu `index.ts`, seus tipos de domínio, repository e testes; expanda o contexto apenas quando necessário.
- Tipos persistidos vêm de `Database`; projeções de query, modelos de domínio e view models ficam próximos do consumidor e não devem ser confundidos.
- Regras de negócio devem ser funções puras quando possível e os testes devem importar a implementação de produção, nunca cópias.
- Prefira módulos coesos a arquivos arbitrariamente pequenos. Não crie wrappers de uma linha sem uma fronteira real.
- Pequena duplicação entre browser e Deno é aceitável quando evita acoplamento de deploy; mantenha fixtures/testes de paridade para regras críticas.
- Preserve a linguagem visual Terracota CRM light-first, dark opcional, tokens semânticos, raios `6/8/12/16px`, Playfair Display para títulos e Inter para UI/corpo.
- Scripts suportados ficam em `scripts/` e no `package.json`. `scripts/legacy` é somente referência histórica e não deve ser executado sem auditoria humana.

## Comandos

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run migrations:check
npm run audit:visual
npm run architecture:check
npm run types:supabase:check
```

Para atualizar tipos após uma mudança remota intencional: `npm run types:supabase`. Para validar automações após deploy autorizado: `npm run verify:automations`.

## Banco e Edge Functions

- Nunca editar, renomear ou remover migrations históricas. Não aplicar migration, deploy ou operação remota sem solicitação explícita.
- Nunca expor `SUPABASE_SERVICE_ROLE_KEY` ao frontend nem usar prefixo `VITE_` nela.
- Não inferir remoção de tabela/coluna por ausência de uso no frontend; procure migrations, SQL, RPCs, Edge Functions e scripts.
- Mantenha `index.ts` das functions como entrada fina; autenticação, domínio e integrações devem ser extraídos quando crescerem.
- Preserve status HTTP, payloads e autenticação externa. Whapi/IA devem ser simulados em testes; não enviar mensagens reais.

## Ao criar ou alterar features

1. Escolha o domínio proprietário e mantenha UI, regras, dados e tipos próximos dele.
2. Reutilize regra compartilhada existente somente se a semântica for realmente idêntica; elimine duplicação de regra de negócio, não force abstração de detalhes locais.
3. Exponha a menor API pública necessária no `index.ts` e evite dependências cruzadas entre features.
4. Adicione testes de caracterização antes de mover lógica crítica.
5. Execute os gates relevantes e diferencie falhas preexistentes das introduzidas pelo diff.

Não introduza `any`, `@ts-ignore` ou disables para esconder erros; não coloque queries em UI; não crie estado derivado ou `useEffect` sem necessidade; não atualize dependências principais, framework ou schema por conveniência; não reformate arquivos alheios à tarefa.
