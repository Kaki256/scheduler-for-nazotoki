FROM oven/bun:latest

ENV NODE_ENV=production

WORKDIR /usr/src/app

COPY package.json bun.lock* ./

RUN bun install

# Copy application source
COPY . .

# セキュリティ: デフォルトの bun ユーザーに権限を切り下げる
USER bun

EXPOSE 3001

CMD ["bun", "run", "server.js"]
