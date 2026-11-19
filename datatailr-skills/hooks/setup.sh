#!/usr/bin/env bash
# Runs at the start of every session. Installs the datatailr SDK and its dt CLI
# once, into the plugin's data folder, puts them on the PATH of the session's
# Bash commands and tells the model whether a CLI login is saved. It never
# fails the session: every problem becomes a sentence for the model.
set -u

data=${CLAUDE_PLUGIN_DATA:-$HOME/.datatailr}
venv=$data/venv
log=$data/setup.log
cfg=$HOME/.dt/remote_client/remote_client.cfg
layout=bin
cli=datatailr
if [ "${OS:-}" = Windows_NT ]; then
  layout=Scripts
  cli=datatailr.exe
fi
bin=$venv/$layout

# The context goes out as one JSON string: backslashes and quotes are escaped.
emit() {
  local text=${1//\\/\\\\}
  text=${text//\"/\\\"}
  printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "Datatailr: $text"
  exit 0
}

if [ ! -x "$bin/$cli" ]; then
  python=$(command -v python3 || command -v python) ||
    emit "Python 3 was not found, so the datatailr SDK is not installed. Before any Datatailr work, use the datatailr-connect skill, which says what to do."
  mkdir -p "$data"
  if ! { "$python" -m venv "$venv" && "$bin/python" -m pip install --quiet --disable-pip-version-check --upgrade datatailr; } >"$log" 2>&1; then
    rm -rf "$venv"
    emit "Installing the datatailr SDK into $venv failed. The log is $log. Before any Datatailr work, use the datatailr-connect skill, which can install the SDK in a project venv instead."
  fi
  # The dt CLI is a shim that the SDK writes next to itself. A login writes it too.
  "$bin/$cli" setup-cli --no-login >>"$log" 2>&1 || true
fi

if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  printf 'export PATH="%s:$PATH"\n' "$bin" >>"$CLAUDE_ENV_FILE"
fi

installed="The datatailr SDK is installed in $bin, which is on the PATH of every Bash command in this session, so datatailr and dt run by name."
if [ -f "$cfg" ]; then
  # Only the URL leaves the file. It also holds the session token.
  url=$(grep -o '"base_url" *: *"[^"]*"' "$cfg" | head -1 | sed 's/.*: *"//; s/"$//')
fi
if [ -n "${url:-}" ]; then
  emit "$installed A CLI login to $url is saved. If a dt command says that the session expired, use the datatailr-connect skill to log in again."
fi
emit "$installed No CLI login is saved. Before any Datatailr work, use the datatailr-connect skill to log in."
