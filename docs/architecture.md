# Arquitetura

## Visão geral

O Kifer Saúde reúne o site público, formulários de captação e um CRM protegido. O frontend React consome Postgres/Auth/Realtime/Storage pelo SDK do Supabase e chama Edge Functions para operações privilegiadas, integrações externas e fluxos de IA.

```text
routes/pages
    ↓
feature components
    ↓
feature hooks/controllers
    ↓
feature domain + data repositories
    ↓
src/infrastructure/supabase ou Edge Functions
    ↓
Postgres / Auth / Storage / Whapi / provedores de IA
```

Dependências apontam para baixo. Um componente pode usar o domínio e a camada de dados de sua própria feature, mas outra feature deve entrar por sua API pública. Infraestrutura não depende de UI.

## Frontend

`src/routes` e `src/main.tsx` definem navegação e lazy loading. `src/pages/routes` contém apenas wrappers de rota; implementação pertence a `src/features`.

As features principais são:

| Domínio | Responsabilidade |
| --- | --- |
| `leads` | cadastro, filtros, Kanban, realtime e relacionamento comercial |
| `contracts` | contratos, titulares, dependentes, documentos e reajustes |
| `agenda` / `reminders` | visualização, recorrência, mutações e follow-ups |
| `dashboard` | read models e agregações operacionais |
| `config` | configurações gerais, integrações, IA e automações |
| `communication/whatsapp` | inbox, mensagens, mídia, contatos e follow-up |
| `communication/whatsapp-campaigns` | criação e acompanhamento de campanhas |
| `public-content` / `blog` | formulários, links e conteúdo público |
| `ai-sandbox` | simulação controlada das configurações de atendimento |

Dentro de uma feature:

- `domain`: tipos e regras sem I/O;
- `data`: queries, repositories e chamadas de Edge Functions;
- `hooks`: estado e coordenação do React;
- `components`: apresentação e interação;
- `index.ts`: superfície pública mínima.

O cliente Supabase fica exclusivamente em `src/infrastructure/supabase`. Repositories tipados usam `databaseClient`; serviços legados ainda não migrados para tipos persistidos podem importar `supabase` diretamente dessa infraestrutura. Tipos de tela e domínio vêm da feature proprietária. O tipo `Database` gerado descreve persistência; não é modelo de tela.

## Backend Supabase

Cada diretório em `supabase/functions` é uma unidade de deploy. O `index.ts` trata HTTP e delega regras puras, persistência e fornecedores para módulos locais ou `_shared`. Dependências compartilhadas entre functions devem ser compatíveis com Deno e não importar código do bundle do frontend.

Migrations são um log append-only. RPCs e triggers concentram invariantes transacionais, especialmente deduplicação/canonicalização do WhatsApp e filas de automação. Consulte [domain-invariants.md](domain-invariants.md) antes de tocar nessas áreas.

## Tipos e erros

- Linha persistida: derivada de `Database` ou tipo de row de uma function.
- Projeção: tipo exato da seleção feita pelo repository.
- Modelo de domínio: sem detalhes acidentais do banco.
- View model: formato pronto para renderização.

Repositories convertem erro de infraestrutura em uma mensagem/erro consistente na fronteira. UI não interpreta payload bruto do PostgREST.

## Áreas ainda em transição

Alguns módulos continuam maiores que o desejado: `WhatsAppInboxScreen.tsx`, a implementação interna de `commWhatsAppService`, `leads-api`, o worker de campanhas e partes de configuração. As fronteiras públicas já foram separadas; novas mudanças devem extrair uma responsabilidade por vez, com teste de caracterização, sem reescrita integral.
