/*
  # Remove Cotador module (complete teardown)

  Drops all Cotador-related tables, functions, indexes, and policies.
  Called after the module was deprecated from the application.
*/

BEGIN;

-- Drop RPC functions first (they reference tables)
-- CASCADE on policy-guard functions drops dependent RLS policies automatically
DROP FUNCTION IF EXISTS public.get_public_cotador_quote_share(text) CASCADE;
DROP FUNCTION IF EXISTS public.upsert_cotador_quote_share(uuid, boolean, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.merge_cotador_hospitais(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.replace_cotador_quote_items(uuid, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.upsert_cotador_quote_bundle(uuid, text, text, uuid, integer, jsonb, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.normalize_cotador_hospital_term(text) CASCADE;
DROP FUNCTION IF EXISTS public.current_user_can_view_cotador() CASCADE;
DROP FUNCTION IF EXISTS public.current_user_can_edit_cotador() CASCADE;

-- Drop tables with CASCADE to handle FK dependencies
DROP TABLE IF EXISTS public.cotador_quote_shares CASCADE;
DROP TABLE IF EXISTS public.cotador_quote_items CASCADE;
DROP TABLE IF EXISTS public.cotador_quote_beneficiaries CASCADE;
DROP TABLE IF EXISTS public.cotador_quotes CASCADE;
DROP TABLE IF EXISTS public.cotador_produto_hospitais CASCADE;
DROP TABLE IF EXISTS public.cotador_hospital_aliases CASCADE;
DROP TABLE IF EXISTS public.cotador_hospitais CASCADE;
DROP TABLE IF EXISTS public.cotador_tabela_faixas_preco CASCADE;
DROP TABLE IF EXISTS public.cotador_tabelas CASCADE;
DROP TABLE IF EXISTS public.cotador_produto_entidades CASCADE;
DROP TABLE IF EXISTS public.cotador_produtos CASCADE;
DROP TABLE IF EXISTS public.cotador_linhas_produto CASCADE;
DROP TABLE IF EXISTS public.cotador_entidades_classe CASCADE;
DROP TABLE IF EXISTS public.cotador_administradoras CASCADE;

-- Remove cotador module permission entries from profile_permissions
DELETE FROM public.profile_permissions WHERE module = 'cotador';

COMMIT;
