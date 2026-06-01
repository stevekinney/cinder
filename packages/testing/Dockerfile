ARG PLAYWRIGHT_VERSION
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-jammy

ARG PLAYWRIGHT_VERSION

ENV PLAYWRIGHT_DOCKER=1
ENV CINDER_PLAYWRIGHT_VERSION=${PLAYWRIGHT_VERSION}
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends unzip \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL https://bun.sh/install | bash \
    && ln -sf /root/.bun/bin/bun /usr/local/bin/bun \
    && ln -sf /root/.bun/bin/bun /usr/local/bin/bunx

WORKDIR /work

ENTRYPOINT ["/bin/bash", "-lc"]
