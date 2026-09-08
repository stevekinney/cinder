ARG PLAYWRIGHT_VERSION
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-jammy

ARG PLAYWRIGHT_VERSION

# The workspace's own `packageManager` pin, passed in by the build. Installing
# whatever bun.sh serves at build time let the container run a Bun the
# repository never pinned, which is invisible until a Bun release changes
# behaviour — and then it reads as the branch under test being broken.
ARG BUN_VERSION

ENV PLAYWRIGHT_DOCKER=1
ENV CINDER_PLAYWRIGHT_VERSION=${PLAYWRIGHT_VERSION}
ENV DEBIAN_FRONTEND=noninteractive

# Fail the build rather than fall back to "latest": an image that silently
# installs an unpinned Bun is exactly the drift this argument exists to stop,
# and a manual `docker build` without it would reintroduce it quietly.
RUN test -n "${BUN_VERSION}" \
    || { echo 'BUN_VERSION build-arg is required (see readPinnedBunVersion)' >&2; exit 1; } \
    && apt-get update \
    && apt-get install -y --no-install-recommends unzip \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}" \
    && ln -sf /root/.bun/bin/bun /usr/local/bin/bun \
    && ln -sf /root/.bun/bin/bun /usr/local/bin/bunx

WORKDIR /work

ENTRYPOINT ["/bin/bash", "-lc"]
