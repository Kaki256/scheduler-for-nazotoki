FROM oven/bun:latest

# 本番環境用の最適化
ENV NODE_ENV=production

WORKDIR /usr/src/app

# 【超重要】モノレポのワークスペースを認識させるため、先に全ファイルをコピーする
COPY . .

# ルートディレクトリでフロント・バックエンド両方の依存関係を一括インストール
RUN bun install --frozen-lockfile

# セキュリティ: デフォルトの bun ユーザーに権限を切り下げる
USER bun

EXPOSE 3001

# 起動コマンド（カレントディレクトリから実行）
CMD ["bun", "run", "start"]