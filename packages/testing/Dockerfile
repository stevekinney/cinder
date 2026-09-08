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

RUN apt-get update \
    && apt-get install -y --no-install-recommends unzip \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}" \
    && ln -sf /root/.bun/bin/bun /usr/local/bin/bun \
    && ln -sf /root/.bun/bin/bun /usr/local/bin/bunx

WORKDIR /work

ENTRYPOINT ["/bin/bash", "-lc"]
