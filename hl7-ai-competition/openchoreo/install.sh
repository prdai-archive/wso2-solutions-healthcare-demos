#!/usr/bin/env sh
# Install OpenChoreo locally on k3d, pinned to a known release. Wraps the
# upstream installer: clones OpenChoreo at a pinned ref, works around two
# upstream host-path assumptions (samples dir + k3d config live only in their
# prebuilt container), then runs it with all planes. After this, run deploy.sh.
# Host needs: docker, k3d (5.8+), kubectl, helm. All planes incl. observability
# want ~6GB RAM free; drop --with-observability via PLANES= on a small machine.
set -eu

OPENCHOREO_REF="${OPENCHOREO_REF:-release-v1.1}"
OPENCHOREO_VERSION="${OPENCHOREO_VERSION:-v1.1.1}"
WORKDIR="${OPENCHOREO_WORKDIR:-/tmp/openchoreo-${OPENCHOREO_REF}}"
PLANES="${PLANES:---with-build --with-observability}"

if [ ! -d "$WORKDIR/.git" ]; then
  echo "[install] cloning OpenChoreo $OPENCHOREO_REF -> $WORKDIR"
  rm -rf "$WORKDIR"
  git clone --depth 1 --branch "$OPENCHOREO_REF" \
    https://github.com/openchoreo/openchoreo "$WORKDIR"
fi

QS="$WORKDIR/install/quick-start"
# Upstream install.sh resolves samples at ${SCRIPT_DIR}/../samples and reads the
# k3d config from .k3d-config.yaml alongside it; both only exist inside their
# prebuilt quick-start container. Provide host equivalents.
ln -sfn "$WORKDIR/samples" "$WORKDIR/install/samples"
cp "$WORKDIR/install/k3d/single-cluster/config.yaml" "$QS/.k3d-config.yaml"

echo "[install] running OpenChoreo installer ($OPENCHOREO_VERSION; planes: $PLANES)"
cd "$QS"
# shellcheck disable=SC2086
exec ./install.sh --version "$OPENCHOREO_VERSION" $PLANES "$@"
