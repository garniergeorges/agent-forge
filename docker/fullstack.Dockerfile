# Agent Forge — fullstack image
# For web fullstack teams (Node + PHP + DB clients).
# Used by the reference team example : Next.js + Laravel.
#
# Status : POC, not built yet.

FROM agent-forge/base:latest

USER root

# ─── PHP + Composer ──────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    php-cli \
    php-fpm \
    php-mbstring \
    php-xml \
    php-curl \
    php-mysql \
    php-pgsql \
    php-sqlite3 \
    composer \
    && rm -rf /var/lib/apt/lists/*

# ─── DB clients ──────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    default-mysql-client \
    postgresql-client \
    redis-tools \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# ─── Node package managers ───────────────────────────────────────
RUN npm install -g pnpm bun

USER agent
WORKDIR /workspace

CMD ["bash"]
