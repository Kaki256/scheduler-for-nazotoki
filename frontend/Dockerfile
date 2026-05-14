FROM oven/bun:latest

WORKDIR /usr/src/app

COPY package.json bun.lock* ./

RUN bun install

COPY . .

EXPOSE 5173

CMD ["bun", "run", "dev", "--host"]
