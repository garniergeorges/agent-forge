# Agent Forge — base image
# Minimal sandbox for simple agents (read, edit, run shell).
#
# Hardening (P5) :
#   - non-root user `agent` (uid 1000) is the default at runtime
#   - /workspace is the only writable dir owned by `agent`
#   - DockerLaunch passes --read-only on the root FS, plus a tmpfs
#     mount on /tmp so package installers and test runners that
#     write under /tmp keep working without granting write to the
#     image
#   - --cap-drop=ALL --security-opt=no-new-privileges
#   - --network=none always — even agents that need an LLM call go
#     through the host's per-run LLM proxy, bind-mounted as a Unix
#     socket at /run/forge/llm.sock. The host injects the API key
#     and forwards only /v1/chat/completions to the real upstream.

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
    && mkdir -p /workspace /run/forge \
    && chown agent:agent /workspace /run/forge
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
