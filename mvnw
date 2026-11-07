#!/bin/sh
# Minimal Maven Wrapper (script only, no jar)
set -e

MVN_VERSION=3.9.9
BASE_DIR=$(cd "$(dirname "$0")" && pwd)
WRAPPER_HOME="${HOME}/.m2/wrapper/dists/apache-maven-${MVN_VERSION}"
MVN_HOME="${WRAPPER_HOME}/apache-maven-${MVN_VERSION}"

if [ ! -x "${MVN_HOME}/bin/mvn" ]; then
  echo "Downloading Apache Maven ${MVN_VERSION} ..."
  mkdir -p "${WRAPPER_HOME}"
  URL="https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/${MVN_VERSION}/apache-maven-${MVN_VERSION}-bin.tar.gz"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "${URL}" -o "${WRAPPER_HOME}/maven.tar.gz"
  else
    wget -q "${URL}" -O "${WRAPPER_HOME}/maven.tar.gz"
  fi
  tar -xzf "${WRAPPER_HOME}/maven.tar.gz" -C "${WRAPPER_HOME}"
  rm -f "${WRAPPER_HOME}/maven.tar.gz"
fi

exec "${MVN_HOME}/bin/mvn" "$@"