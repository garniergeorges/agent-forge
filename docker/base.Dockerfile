# Agent Forge — base image
# Minimal sandbox for simple agents (read, edit, run shell).
#
# Status : POC, not built yet. This file is a sketch of the target.

FROM debian:bookworm-slim

# ─── Base tooling ────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    wget \
    ca-certificates \
    jq \
    ripgrep \
    bash \
    && rm -rf /var/lib/apt/lists/*

# ─── Node 22 LTS (for the runtime + Node-using agents) ───────────
ENV NODE_VERSION=22
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# ─── Non-root user ───────────────────────────────────────────────
RUN useradd -m -s /bin/bash agent \
    && mkdir -p /workspace \
    && chown agent:agent /workspace
USER agent
WORKDIR /workspace

# ─── Agent Forge runtime ─────────────────────────────────────────
# In production, this would be COPY-ed from the build stage.
# For POC, mounted via volume during dev.
# COPY --chown=agent ./runtime /opt/agent-forge
# ENV PATH="/opt/agent-forge/bin:$PATH"

# ─── Default entrypoint ──────────────────────────────────────────
# ENTRYPOINT ["forge-runtime"]
CMD ["bash"]
