#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/bin:/usr/local/bin:${JAVA_HOME:-/usr/java/jdk-25}/bin:${PATH}"
export JAVA_HOME="${JAVA_HOME:-/usr/java/jdk-25}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"
export MICRONAUT_ENVIRONMENTS="${MICRONAUT_ENVIRONMENTS:-local,override}"

cd /workspace

mkdir -p cli/src/main/resources
if [[ ! -f cli/src/main/resources/application-override.yml ]]; then
    cat > cli/src/main/resources/application-override.yml <<'EOF'
micronaut:
  server:
    cors:
      enabled: true
      configurations:
        all:
          allowedOrigins:
            - http://localhost:5173
EOF
fi

mkdir -p local/plugins

JAVA_BIN="${JAVA_HOME}/bin/java"
if [[ ! -x "$JAVA_BIN" ]] || ! "$JAVA_BIN" -version 2>&1 | grep -q 'version "25'; then
    echo "JDK 25 is required. Use a base snapshot with Temurin 25 installed under /usr/java/jdk-25."
    exit 1
fi
export PATH="${JAVA_HOME}/bin:/usr/bin:/usr/local/bin:${PATH}"

NODE_BIN="/usr/bin/node"
if ! "$NODE_BIN" --version | grep -qE '^v24\.'; then
    echo "Node.js 24 is required (found $($NODE_BIN --version))."
    exit 1
fi

if [[ "$(/usr/bin/npm --version)" != 11.* ]]; then
    sudo npm i -g npm@11.16.0
fi

cd ui
/usr/bin/npm ci
cd /workspace

./gradlew :cli:classes --no-daemon
