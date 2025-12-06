FROM node:22-bookworm-slim

ENV NODE_ENV=production

WORKDIR /usr/src/app

# Keep base image patched
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

# Install only production dependencies (lockfile not present in this context)
COPY package.json ./
RUN npm install --omit=dev

# Copy application source
COPY . .

# Drop root privileges (skip chown to avoid overlay FS I/O issues)
RUN useradd -m app
USER app

EXPOSE 3001

CMD ["node", "server.js"]
