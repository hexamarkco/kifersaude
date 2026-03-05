#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="$REPO_ROOT/supabase.local.ini"
DEFAULT_PROJECT_REF="eaxvvhamkmovkoqssahj"

if ! command -v supabase >/dev/null 2>&1; then
  echo "[ERRO] Supabase CLI nao encontrado no WSL."
  echo "Instale no Ubuntu com:"
  echo "curl -fsSL https://github.com/supabase/cli/releases/download/v2.75.0/supabase_2.75.0_linux_amd64.deb -o /tmp/supabase.deb && sudo dpkg -i /tmp/supabase.deb"
  exit 1
fi

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "[ERRO] Arquivo nao encontrado: $CONFIG_FILE"
  echo "Copie o exemplo e preencha os valores:"
  echo "cp supabase.local.ini.example supabase.local.ini"
  exit 1
fi

PROJECT_REF="$DEFAULT_PROJECT_REF"
DB_PASSWORD=""
SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-}"

while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
  line="${raw_line%$'\r'}"

  case "$line" in
    "" | \#* | \;*)
      continue
      ;;
  esac

  [[ "$line" == *=* ]] || continue

  key="${line%%=*}"
  value="${line#*=}"

  key="${key#"${key%%[![:space:]]*}"}"
  key="${key%"${key##*[![:space:]]}"}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"

  case "$key" in
    PROJECT_REF)
      PROJECT_REF="$value"
      ;;
    DB_PASSWORD)
      DB_PASSWORD="$value"
      ;;
    SUPABASE_ACCESS_TOKEN)
      SUPABASE_ACCESS_TOKEN="$value"
      ;;
  esac
done <"$CONFIG_FILE"

if [[ -z "$SUPABASE_ACCESS_TOKEN" ]]; then
  echo "[ERRO] SUPABASE_ACCESS_TOKEN nao definido em supabase.local.ini"
  exit 1
fi

export SUPABASE_ACCESS_TOKEN

cd "$REPO_ROOT"

echo "=== Link do projeto: $PROJECT_REF ==="
if [[ -z "$DB_PASSWORD" ]]; then
  supabase link --project-ref "$PROJECT_REF"
else
  supabase link --project-ref "$PROJECT_REF" --password "$DB_PASSWORD"
fi

echo "=== Aplicando migrations (db push) ==="
if [[ -z "$DB_PASSWORD" ]]; then
  supabase db push
else
  supabase db push --password "$DB_PASSWORD"
fi

echo "=== Migrations aplicadas com sucesso ==="
