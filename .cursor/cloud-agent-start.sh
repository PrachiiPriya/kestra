#!/usr/bin/env bash
set -euo pipefail

export JAVA_HOME="${JAVA_HOME:-/usr/java/jdk-25}"
export PATH="${JAVA_HOME}/bin:/usr/bin:/usr/local/bin:${PATH}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"
export MICRONAUT_ENVIRONMENTS="${MICRONAUT_ENVIRONMENTS:-local,override}"

cd /workspace

TMUX_SOCKET="${TMUX_SOCKET:-/tmp/kestra-cloud-agent.tmux}"
export TMUX_TMPDIR="${TMUX_TMPDIR:-/tmp}"
mkdir -p "$(dirname "$TMUX_SOCKET")"

tmux() {
    command tmux -f /exec-daemon/tmux.portal.conf -S "$TMUX_SOCKET" "$@"
}

wait_for_url() {
    local url="$1"
    local attempts="${2:-90}"
    for _ in $(seq 1 "$attempts"); do
        if curl -sf "$url" >/dev/null; then
            return 0
        fi
        sleep 2
    done
    return 1
}

wait_for_backend() {
    local attempts="${1:-90}"
    for _ in $(seq 1 "$attempts"); do
        local code
        code="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8080/" || true)"
        if [[ "$code" =~ ^[234] ]]; then
            return 0
        fi
        sleep 2
    done
    return 1
}

if command -v docker >/dev/null && docker info >/dev/null 2>&1; then
    docker compose -f docker-compose-ci.yml up -d
fi

if ! wait_for_backend 3; then
    if ! tmux has-session -t kestra_backend 2>/dev/null; then
        tmux new-session -d -s kestra_backend -c /workspace \
            "export JAVA_HOME='${JAVA_HOME}' PATH='${PATH}' MICRONAUT_ENVIRONMENTS='${MICRONAUT_ENVIRONMENTS}'; ./gradlew runLocal --no-daemon 2>&1 | tee /tmp/kestra-backend.log"
    fi
    if ! wait_for_backend 120; then
        echo "Kestra backend did not become ready. See /tmp/kestra-backend.log"
        exit 1
    fi
fi

if ! wait_for_url "http://127.0.0.1:5173/" 3; then
    if ! tmux has-session -t kestra_ui 2>/dev/null; then
        tmux new-session -d -s kestra_ui -c /workspace/ui \
            "export PATH='/usr/bin:/usr/local/bin' NODE_OPTIONS='${NODE_OPTIONS}'; /usr/bin/npm run dev 2>&1 | tee /tmp/kestra-ui.log"
    fi
    if ! wait_for_url "http://127.0.0.1:5173/" 120; then
        echo "Kestra UI did not become ready. See /tmp/kestra-ui.log"
        exit 1
    fi
fi
