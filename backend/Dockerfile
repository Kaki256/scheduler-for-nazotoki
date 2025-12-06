FROM node:22-bookworm-slim

ENV NODE_ENV=production

WORKDIR /usr/src/app

# Keep base image patched
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

# Enable pnpm and install only production dependencies using the lockfile
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy application source
COPY . .

# Drop root privileges
RUN useradd -m app && chown -R app /usr/src/app
USER app

EXPOSE 3001

CMD ["node", "server.js"]
