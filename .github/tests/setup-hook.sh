#!/usr/bin/env bash
# Usage: bash .github/tests/setup-hook.sh
# Runs hooks/setup.sh against a fake home folder, a fake plugin data folder and
# a stub python3 that creates a fake venv, and checks what the hook does.
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
hook=$root/hooks/setup.sh
real_python=$(command -v python3)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

fail() {
  echo "$1 failed"
  exit 1
}

# The stub python3: `-m venv <dir>` makes a fake venv, `-m pip install` makes
# the fake CLI programs in it. Each call is logged. A `fail-pip` file makes
# the install fail.
mkdir -p "$work/stub"
cat >"$work/stub/python3" <<STUB
#!/usr/bin/env bash
echo "\$*" >>"$work/calls.log"
layout=bin
[ "\${OS:-}" = Windows_NT ] && layout=Scripts
if [ "\$1" = -m ] && [ "\$2" = venv ]; then
  mkdir -p "\$3/\$layout" && cp "\$0" "\$3/\$layout/python" && exit 0
fi
if [ "\$1" = -m ] && [ "\$2" = pip ]; then
  [ -e "$work/fail-pip" ] && { echo "No matching distribution found for datatailr" >&2; exit 1; }
  here=\$(cd "\$(dirname "\$0")" && pwd)
  printf '#!/usr/bin/env bash\necho "datatailr \$*" >>"%s"\n[ "\$1" = setup-cli ] && cp "\$0" "\$(dirname "\$0")/dt"\nexit 0\n' "$work/calls.log" >"\$here/datatailr"
  chmod +x "\$here/datatailr" && exit 0
fi
echo "unexpected python call: \$*" >&2
exit 2
STUB
chmod +x "$work/stub/python3"

run() {
  env -i PATH="$work/stub:/usr/bin:/bin" HOME="$work/home" "$@" bash "$hook" </dev/null
}
context() {
  "$real_python" -c 'import json, sys; d = json.load(sys.stdin)["hookSpecificOutput"]; assert d["hookEventName"] == "SessionStart"; print(d["additionalContext"])'
}
calls() { grep -c . "$work/calls.log" 2>/dev/null || echo 0; }

mkdir -p "$work/home"
data=$work/data

# A first run installs the SDK into the plugin data folder, exports its bin
# folder for the session and says that no login is saved.
out=$(run CLAUDE_PLUGIN_DATA="$data" CLAUDE_ENV_FILE="$work/env.sh") || fail "first run exits 0"
text=$(context <<<"$out") || fail "first run prints a SessionStart context"
test -x "$data/venv/bin/datatailr" || fail "the SDK is installed in the data folder"
test -x "$data/venv/bin/dt" || fail "the dt shim is written by setup-cli"
grep -qx 'datatailr setup-cli --no-login' "$work/calls.log" || fail "setup-cli runs without a login"
[ "$(calls)" = 3 ] || fail "venv, pip and setup-cli run once each"
grep -qx "export PATH=\"$data/venv/bin:\$PATH\"" "$work/env.sh" || fail "the bin folder is exported"
grep -q "$data/venv/bin" <<<"$text" || fail "the context names the bin folder"
grep -q 'datatailr-connect' <<<"$text" || fail "the context points to the connect skill"
grep -qi 'no CLI login is saved' <<<"$text" || fail "the context says that no login is saved"

# A second run installs nothing and exports again.
out=$(run CLAUDE_PLUGIN_DATA="$data" CLAUDE_ENV_FILE="$work/env2.sh") || fail "second run exits 0"
[ "$(calls)" = 3 ] || fail "second run installs nothing"
grep -q "venv/bin" "$work/env2.sh" || fail "second run exports the bin folder"

# A saved CLI session names its URL in the context, and never the token.
mkdir -p "$work/home/.dt/remote_client"
printf '{"base_url": "https://app.example.com", "jwt_cookie": "SECRET-TOKEN-VALUE"}\n' >"$work/home/.dt/remote_client/remote_client.cfg"
text=$(run CLAUDE_PLUGIN_DATA="$data" CLAUDE_ENV_FILE="$work/env3.sh" | context) || fail "run with a session"
grep -q 'https://app.example.com' <<<"$text" || fail "the context names the installation"
grep -q 'SECRET-TOKEN-VALUE' <<<"$text" && fail "the context never holds the token"
grep -qi 'no CLI login is saved' <<<"$text" && fail "a saved session is not reported as missing"
rm -r "$work/home/.dt"

# Without the plugin data folder, the venv goes under the home folder. Without
# an environment file, the context still names the bin folder.
text=$(run | context) || fail "run without plugin variables"
test -x "$work/home/.datatailr/venv/bin/datatailr" || fail "the fallback venv is under the home folder"
grep -q "$work/home/.datatailr/venv/bin" <<<"$text" || fail "the context names the fallback bin folder"

# On Windows the venv keeps its programs in Scripts.
text=$(run CLAUDE_PLUGIN_DATA="$work/win" CLAUDE_ENV_FILE="$work/env-win.sh" OS=Windows_NT | context) || fail "run on Windows"
test -x "$work/win/venv/Scripts/datatailr" || fail "the Windows venv has a Scripts folder"
grep -qx "export PATH=\"$work/win/venv/Scripts:\$PATH\"" "$work/env-win.sh" || fail "the Scripts folder is exported"

# A failed install keeps the session alive and explains, and a later run tries again.
touch "$work/fail-pip"
out=$(run CLAUDE_PLUGIN_DATA="$work/broken" CLAUDE_ENV_FILE="$work/env-broken.sh") || fail "a failed install exits 0"
text=$(context <<<"$out") || fail "a failed install prints a context"
grep -qi 'failed' <<<"$text" || fail "a failed install is reported"
grep -q 'datatailr-connect' <<<"$text" || fail "a failed install points to the connect skill"
grep -q 'No matching distribution' "$work/broken/setup.log" || fail "the log holds the pip output"
test ! -e "$work/env-broken.sh" || fail "a failed install exports nothing"
rm "$work/fail-pip"
run CLAUDE_PLUGIN_DATA="$work/broken" >/dev/null || fail "the retry exits 0"
test -x "$work/broken/venv/bin/datatailr" || fail "a later run installs after a failure"

# Without Python the hook explains and exits 0. The tools folder holds only
# the programs the hook needs, so no system python is found.
mkdir -p "$work/tools"
for tool in bash grep sed head mkdir rm; do ln -s "$(command -v "$tool")" "$work/tools/$tool"; done
out=$(env -i PATH="$work/tools" HOME="$work/home" CLAUDE_PLUGIN_DATA="$work/nopy" bash "$hook" </dev/null) || fail "no python exits 0"
text=$(context <<<"$out") || fail "no python prints a context"
grep -qi 'python' <<<"$text" || fail "a missing python is reported"

echo PASS
