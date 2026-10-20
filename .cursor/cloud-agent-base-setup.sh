#!/usr/bin/env bash
# One-time base image preparation (baked into the environment snapshot, not run on every install).
set -euo pipefail

sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates curl git unzip build-essential python3 tmux

if [[ ! -d /usr/java/jdk-25 ]]; then
    tmp="$(mktemp -d)"
    curl -fsSL \
        "https://github.com/adoptium/temurin25-binaries/releases/download/jdk-25.0.2%2B10/OpenJDK25U-jdk_x64_linux_hotspot_25.0.2_10.tar.gz" \
        -o "$tmp/openjdk25.tar.gz"
    sudo mkdir -p /usr/java
    sudo tar -xzf "$tmp/openjdk25.tar.gz" -C /usr/java
    sudo mv /usr/java/jdk-25.0.2+10 /usr/java/jdk-25
    rm -rf "$tmp"
fi

for bin in java javac; do
    sudo ln -sf "/usr/java/jdk-25/bin/$bin" "/usr/local/bin/$bin"
done

if ! /usr/bin/node --version 2>/dev/null | grep -qE '^v24\.'; then
    curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
sudo npm i -g npm@11.16.0

sudo npx --yes playwright@1.49.1 install-deps chromium
