#!/usr/bin/env bash
# Checks the local ACE-Step setup before /make-music generates anything. Exit 1 on a blocker.
#   bash GamesTemplate/other-services/skills/make-music/preflight.sh
# ACESTEP_DIR overrides the install folder (default: ACE-Step-1.5 next to the repo).
set -u
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
ACE="${ACESTEP_DIR:-$(dirname "$ROOT")/ACE-Step-1.5}"
PY="$ACE/.venv/Scripts/python.exe"; [ -x "$PY" ] || PY="$ACE/.venv/bin/python"
bad=0
ok()   { echo "  ok   $1"; }
fail() { echo "  FAIL $1"; bad=1; }
warn() { echo "  WARN $1"; }

echo "make-music preflight (ACE-Step at $ACE)"
[ -d "$ACE" ] && ok "install folder" || fail "no install at $ACE: git clone --depth 1 https://github.com/ace-step/ACE-Step-1.5.git there, then uv sync"
[ -x "$PY" ] && ok "venv python" || fail "no .venv: run 'uv sync' in $ACE"
if [ -x "$PY" ]; then
  "$PY" -c "import torch,sys; sys.exit(0 if torch.cuda.is_available() else 1)" 2>/dev/null && ok "torch sees the GPU" || fail "torch has no CUDA (RTX 50xx needs the cu128 build that uv sync installs)"
  "$PY" -c "import soundfile as sf,sys; sys.exit(0 if 'MP3' in sf.available_formats() else 1)" 2>/dev/null && ok "soundfile writes MP3 (loopify)" || fail "soundfile without MP3 support"
fi
ENV="$ACE/.env"
if [ -f "$ENV" ]; then
  grep -q '^ACESTEP_CONFIG_PATH=acestep-v15-xl-sft' "$ENV" && ok "DiT model = xl-sft" || warn "ACESTEP_CONFIG_PATH is not acestep-v15-xl-sft (turbo sounds mechanical)"
  grep -q '^ACESTEP_CONFIG_PATH[23]=.\+' "$ENV" && fail "a second DiT slot is set (CONFIG_PATH2/3): both stay on the GPU and the decode falls to the CPU and hangs. Remove it" || ok "one DiT model only"
  grep -q '^ACESTEP_LM_BACKEND=pt' "$ENV" && ok "LM backend = pt" || fail "set ACESTEP_LM_BACKEND=pt in .env (vllm is not available on Windows)"
else
  fail "no $ENV: cp .env.example .env, then set ACESTEP_CONFIG_PATH=acestep-v15-xl-sft and ACESTEP_LM_BACKEND=pt"
fi
if curl -s -m 2 http://127.0.0.1:8001/health >/dev/null 2>&1; then
  ok "API server up on :8001"
else
  # free VRAM only means something before the server loads its models
  if command -v nvidia-smi >/dev/null; then
    free=$(nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits | head -1)
    [ "${free:-0}" -ge 12000 ] && ok "GPU free ${free} MiB" || warn "GPU free ${free} MiB (XL wants ~12 GB: close other GPU apps first)"
  fi
  warn "API server not running. Start it in the background (models load on the first request, ~1 min; first run downloads ~20 GB):"
  echo "         cd \"$ACE\" && PYTHONIOENCODING=utf-8 uv run --no-sync acestep-api --host 127.0.0.1 --port 8001 > server.log 2>&1"
fi
exit $bad
