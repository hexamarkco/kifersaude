#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="$REPO_ROOT/supabase.local.ini"
FUNCTIONS_DIR="$REPO_ROOT/supabase/functions"
STATE_DIR="$REPO_ROOT/.deploy-cache"
STATE_FILE="$STATE_DIR/supabase-functions-state.txt"
DEFAULT_PROJECT_REF="eaxvvhamkmovkoqssahj"

compute_function_hash() {
  local function_path="$1"
  local file relative file_hash manifest=""
  local -a files=()

  while IFS= read -r -d '' file; do
    files+=("$file")
  done < <(find "$function_path" -type f -print0 | sort -z)

  for file in "${files[@]}"; do
    relative="${file#"$function_path"/}"
    read -r file_hash _ < <(sha256sum "$file")
    if [[ -n "$manifest" ]]; then
      manifest+=$'\n'
    fi
    manifest+="${relative}|${file_hash}"
  done

  printf '%s' "$manifest" | sha256sum | cut -d' ' -f1
}

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

if [[ ! -d "$FUNCTIONS_DIR" ]]; then
  echo "[ERRO] Diretorio nao encontrado: $FUNCTIONS_DIR"
  exit 1
fi

mkdir -p "$STATE_DIR"

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

shopt -s nullglob
function_paths=("$FUNCTIONS_DIR"/*/)

if (( ${#function_paths[@]} == 0 )); then
  echo "[ERRO] Nenhuma function encontrada em $FUNCTIONS_DIR"
  exit 1
fi

declare -A previous_hashes=()
if [[ -f "$STATE_FILE" ]]; then
  while IFS='=' read -r function_name function_hash; do
    [[ -n "$function_name" ]] || continue
    previous_hashes["$function_name"]="$function_hash"
  done <"$STATE_FILE"
fi

deployed_count=0
skipped_count=0
failed_count=0
NO_VERIFY_JWT_FUNCTIONS=(
  "create-initial-admin"
)

next_state_file="$(mktemp "$STATE_DIR/supabase-functions-state.XXXXXX")"
trap 'rm -f "$next_state_file"' EXIT

for function_path in "${function_paths[@]}"; do
  function_name="$(basename "$function_path")"
  deploy_args=()
  current_hash="$(compute_function_hash "$function_path")"
  previous_hash="${previous_hashes[$function_name]:-}"

  if [[ -n "$previous_hash" && "$previous_hash" == "$current_hash" ]]; then
    echo "=== Pulando function: $function_name (sem alteracoes desde o ultimo deploy) ==="
    printf '%s=%s\n' "$function_name" "$current_hash" >>"$next_state_file"
    skipped_count=$((skipped_count + 1))
    continue
  fi

  for no_verify_name in "${NO_VERIFY_JWT_FUNCTIONS[@]}"; do
    if [[ "$function_name" == "$no_verify_name" ]]; then
      deploy_args+=("--no-verify-jwt")
      break
    fi
  done

  if (( ${#deploy_args[@]} > 0 )); then
    echo "=== Deploy da function: $function_name (JWT sem verificacao) ==="
  else
    echo "=== Deploy da function: $function_name (JWT padrao) ==="
  fi

  if supabase functions deploy "$function_name" "${deploy_args[@]}"; then
    printf '%s=%s\n' "$function_name" "$current_hash" >>"$next_state_file"
    deployed_count=$((deployed_count + 1))
  else
    failed_count=$((failed_count + 1))
  fi
done

mv "$next_state_file" "$STATE_FILE"
trap - EXIT

echo "=== Deploy concluido. $deployed_count function(s) publicadas, $skipped_count sem alteracoes, $failed_count falharam. ==="

if (( failed_count > 0 )); then
  exit 1
fi
