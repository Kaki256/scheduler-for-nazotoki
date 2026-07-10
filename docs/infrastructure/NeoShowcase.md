# NeoShowcase

部内向け**PaaS基盤**です。
HerokuやVercelのように、いろんなアプリを動かすことができます。

https://ns.trap.jp/

![image.png](https://wiki.trap.jp/files/6572f1525329ea001450e6b9)

### できること

忙しい人は [サンプル集](#samples) も見てね

- github.io のように[静的なウェブページを配信する](#samples)
- 任意のアプリケーションを動かす
    - アプリケーション環境にSSHしていろいろいじれる
- Gitにプッシュするだけで更新される
    - デフォルトで一定間隔で更新を見に行きます
    - 手動更新やwebhookで更新を知らせることもできます

質問などはtraQの `#services/feedback` へお気軽に。

## 使い方

1. 管理画面 https://ns.trap.jp/ を開きます。
2. 「Add New App」ボタンより、アプリを登録します。
    - リポジトリを選択します。必要な場合は、[gitリポジトリを追加](#register-repo)します。
    - [ビルド設定を入力](#build-settings)します。
    - [アクセスURLを設定](#access-urls)します。

:::warning

アプリを利用する際の[注意事項](#precautions)もご覧ください。

:::

## <a name="register-repo"></a>Gitリポジトリの登録

デプロイしたいアプリのGitリポジトリを登録します。
次のフローチャートを辿って、それぞれの説明を読んでください。

![image.png](https://wiki.trap.jp/files/64ddce11746fa800133a5302)

### Case 1. traP Gitea (git.trap.jp) の場合

何もしなくても同期されます。何もしないでください。
リポジトリ作成後1分以上経ち、選択画面に現れない場合は、バグなので報告してください。

### Case 2. public リポジトリの場合

基本的にはHTTPSのURLを用いてください。
例: `https://github.com/traPtitech/NeoShowcase.git`

- 「**認証を使用しない**」を選択
    - リポジトリURL: 例のようなURLを入力。

登録ボタンを押して登録します。

:::info

Optional: traP Gitea, GitHub traP-jp organization **以外**の場合、リポジトリのWebhookの設定で、pushイベントを

- GitHub: `https://ns.trap.jp/api/webhook/github`
    - Content-Type: application/json
- Gitea: `https://ns.trap.jp/api/webhook/gitea`

に飛ばすことで、即時ビルドを開始させるようにできます。

traP Gitea と GitHub の traP-jp organizaion ではデフォルトでWebhookが設定されているため、push後即時ビルドが開始されます。

:::

### Case 3. private リポジトリの場合

基本的にはSSH認証を用いてください。
例: `git@github.com:traPtitech/NeoShowcase.git`

- 「**SSH公開鍵認証**」を選択
    - リポジトリURL: 例のようなSSHのURLを入力。
    - GitHubのリポジトリの場合、「**専用公開鍵を生成する**」ボタンをクリック。GitHubではなぜか同じ公開鍵を複数リポジトリに登録できないためこういう仕様になっています。

自身のprivateリポジトリの「デプロイキー」設定に、上の操作でNeoShowcase上で表示された公開鍵を追加してください。

登録ボタンを押して登録します。

## <a name="build-settings"></a>ビルド設定

Gitリポジトリを登録したら、アプリのビルド設定を入力します。

ビルド設定は、**コマンドでアプリを起動するタイプ**（**Runtime**）と、**静的ページを配信するタイプ**（**Static**）の大きく2つに分かれます。
さらに、Buildpacks, Command, Dockerfileの3つのタイプがあり、この順でより詳細な設定が可能です。

次のフローチャートを辿って、該当するビルド設定の説明を読んでください。
具体的な設定のヒントは[サンプル集](#samples)にもあります。

![image.png](https://wiki.trap.jp/files/652e4244bd002b001a2bc0b2)

### ビルド設定 Case 1. Runtime Buildpack

Runtimeアプリの一番基本的かつ楽な設定。

HerokuやVercelのように、ビルド設定をリポジトリから†いい感じに†検出します。

- Context: ビルドしたいディレクトリのリポジトリルートからの相対パス。基本的には `.` を指定。
- (高度な設定) Entrypoint, Command: イメージの設定を上書きします。
    - https://buildpacks.io/docs/app-developer-guide/run-an-app/ と同等です。

ビルドが通らない場合は、その言語標準の「やり方」に従っているかを確認してみてください。
これは、例えばGoの場合はgo.modがありルートにmainパッケージがあるか、Node.jsの場合はpackage.jsonにbuildとstartスクリプトがあるか、等の設定であり、buildpackはこうした「標準のやり方」からビルド方法を自動検出するためです。

詳細は、「paketo buildpacks (言語名)」で設定すべき項目を調べてください。
cf. [設定サンプル集](#samples)も参照

### ビルド設定 Case 2. Runtime Command

Runtimeアプリのより詳細な設定。

ベースとなるDocker Imageを指定し、ビルドコマンドと、起動コマンドを設定します。

Dockerfileが分かる人はRuntime Dockerfileを推奨します。

- Base Image: ベースとなるDocker Imageで、言語ごとに異なります。
    - `イメージ名:タグ名` のように書きます。
    - https://hub.docker.com/ から必要なベースイメージを検索してください。
- Build Command: ビルド時に実行するコマンド。
- Entrypoint: アプリ起動コマンド。
- (高度な設定) Command: Entrypointに追加するアプリ起動コマンド。

:::info

#### 忙しい人のためのBase Image一覧

まずは Runtime Command ではなく、**Runtime Buildpack によるビルドを検討してみてください**。
Buildpack によるビルドは**特別な設定が必要無く**、プログラミング言語ごとの**最適なビルドを自動で行ってくれます**。

それでもなお自身でベースイメージを選択する場合は、よりイメージサイズが小さいものを意識して選んでみてください。
だいたい `-alpine` とか `-slim` とかが付いていたらイメージサイズが小さいはずです。

- go: `golang:1-alpine`
- java: `amazoncorretto:17`
- node: `node:20-alpine`
- php: `php:8-fpm-alpine`
- python: `python:3-alpine`
- ruby: `ruby:3.2-alpine`

各イメージの最新バージョンは適宜確認してください。

:::

### ビルド設定 Case 3. Runtime Dockerfile

Runtimeアプリの最も高度な設定。

Dockerfileを書き、リポジトリ内に配置しておきます。
このDockerfile名をビルド設定から参照します。

- Dockerfile Name: Dockerfileへのリポジトリルートからの相対パス。例: `Dockerfile`, `dev/Dockerfile`
- Context: ビルドしたいディレクトリのリポジトリルートからの総体パス。例: `.`, `dev`
    - Dockerfile Nameはこのパスから計算されます。例えばContextに `dev` を、Dockerfile Nameに `Dockerfile` を指定した場合、リポジトリルートから見て `./dev/Dockerfile` を使用します。
- Entrypoint: ENTRYPOINTを上書きします。
- Command: COMMANDを上書きします。

:::info

#### イメージサイズを小さくする

サーバーのストレージをできるだけ多くの人が使えるように、イメージサイズを軽量化できないか検討してみてください。

- Runtime Dockerfile ではなく、**Runtime Buildpack によるビルドを検討する**
    - 共通ベースイメージを使用でき、言語ごとの最適なビルドを自動でしてくれるため、自分自身が最適化をする必要が無くなります
- サイズの小さい Base Image を選択する
    - 詳しくは [忙しい人のためのBase Image一覧](https://wiki.trap.jp/services/NeoShowcase#head10)を参考
- 適切な`.dockerignore`を設定する
- [Multi-stage build](https://docs.docker.com/build/building/multi-stage/)を活用する

などを試してみてください。

:::

### ビルド設定 Case 4. Static Buildpack

**ビルドが必要な**静的配信の一番基本的な設定。

ビルドが必要な静的配信（例: SPAのフロントエンド）に限ります。
ビルドが必要無い場合は、Static Commandを選びます。

HerokuやVercelのように、ビルド設定をリポジトリから†いい感じに†検出します。

- Context: ビルドしたいディレクトリのリポジトリルートからの相対パス。基本的には `.` を指定。
- Artifact Path: ビルド実行後、配信したいファイルが生成されるディレクトリの、Contextからの相対パス。例: `dist`
- Single Page Application: SPA (Single Page Application) をサーブするときはチェックを入れる。
    - いい感じに `/index.html` などにフォールバックします。

ビルドが通らない場合は、その言語標準の「やり方」に従っているかを確認してみてください。
これは、例えばNode.jsの場合はpackage.jsonにbuildとrunスクリプトがあるか等の設定であり、buildpackはこうした「標準のやり方」からビルド方法を自動検出するためです。

詳細は、「paketo buildpacks (言語名)」で設定すべき項目を調べてください。
cf. [設定サンプル集](#samples)も参照

### ビルド設定 Case 5. Static Command

静的配信のより詳細な設定。
**ビルドが必要無い場合**（リポジトリファイルをそのまま配信する場合）もこの設定。

ベースとなるDocker Imageを指定し、ビルドコマンドと、配信ファイルが生成されるディレクトリを設定します。
ビルドが必要無い場合は、配信ファイルのディレクトリのみを設定します。

- Base Image: ビルド時のベースイメージ。`イメージ名:タグ名` のように書きます。
    - ビルドコマンドを実行しない場合は、空にしてください。
    - ビルドコマンドを実行する場合は、上の Runtime Command の説明を参考にしてください。
- Build Command: ビルド時に実行するコマンド。空の場合は何もしません。
- Artifact Path: ビルドコマンド実行後、配信したいファイルが生成されるディレクトリの、リポジトリルートからの相対パス。例: `dist`
- Single Page Application: SPA (Single Page Application) をサーブするときはチェックを入れる。
    - いい感じに `/index.html` などにフォールバックします。

### ビルド設定 Case 6. Static Dockerfile

静的配信の最も高度な設定。

Dockerfileを書き、リポジトリ内に配置しておきます。
このDockerfile名をビルド設定から参照します。

Dockerfileの最終ステージが実行された後、生成されたイメージの特定のパスから静的配信ファイルを抽出します。

- Dockerfile Name: Dockerfileへのリポジトリルートからの相対パス。例: `Dockerfile`, `dev/Dockerfile`
- Context: ビルドしたいディレクトリのリポジトリルートからの相対パス。例: `.`, `dev`
    - Dockerfile Nameはこのパスから計算されます。例えばContextに `dev` を、Dockerfile Nameに `Dockerfile` を指定した場合、リポジトリルートから見て `./dev/Dockerfile` を使用します。
- Artifact Path: Dockerfileの最終ステージ実行後、配信したいファイルが生成されるディレクトリのパス。例: `dist`
- Single Page Application: SPA (Single Page Application) をサーブするときはチェックを入れる。
    - いい感じに `/index.html` などにフォールバックします。

## <a name="access-urls"></a>アクセスURL設定

次の形式で、1つのアプリに0個以上のURLを設定できます。

`http(s)://(NeoShowcaseが管理する任意のホスト)/(任意のPath Prefix)`

### 使用可能ホスト名

- `*.trap.show`
- `*.trap.games`

任意の段階のネストができます。例: `foo.bar.trap.show` を設定可能

:::warning

#### ネスト時の注意

httpsのサイトを設定すると、証明書がNeoShowcaseに既に存在しない場合は、新たに証明書が取得されます。

- 例: `https://toki.trap.show` を設定 → `*.trap.show` の証明書がNeoShowcaseに存在しなければ取得される
- 例: `https://foo.bar.trap.show` を設定 → `*.bar.trap.show` の証明書がNeoShowcaseに存在しなければ取得される

新しい証明書の取得にはLet's Encryptの制限（50 / week）があるため、**ドメイン名は慎重に決めてください**。

:::

:::info

#### (高度な設定) CDNについて

以下のドメインについて、CloudflareのCDNを通しています。
適切なキャッシュヘッダーを付与することにより、サーバー側への帯域を抑えて配信が可能となります。

- `cdn.trap.show`
- `cdn.trap.games`

現在これらのドメインしかCDNを設定していないので、可能ならば使用する際はPath Prefixを付け、分け合って使ってください。
[設定ファイル](https://git.trap.jp/SysAd/dns)

:::

### traP部員認証

アクセスしてきた人がtraPの部員であるかどうかを確認（"認証"）できます。

- Off (デフォルト): 部員以外もアクセスできます。
- Soft: 部員以外もアクセスできます。非強制の"認証"を行えます。
    - `/_oauth/login?redirect=/` にアクセスをリダイレクトさせることで、"認証"が可能です。
- Hard: 部員以外はアクセスできません。強制的に"認証"を行います。
    - アクセスした人が"認証済み"で無い場合、自動的にtraQのOIDC/OAuth2により"認証"を行います。これに関してユーザーが設定する項目はありません。

アクセスした人が"認証済み"の場合、アプリに渡った（プロキシされた）HTTPリクエストの、以下のヘッダー内容を見ることでtraQ IDを入手できます。

- `X-Forwarded-User`
- `X-Showcase-User`
    - 互換性のために残してあります

:::info

「traQ (q.trap.jp) でのログイン状態」と「NeoShowcaseの部員認証状態」は全くの別状態であることに注意してください。
部員認証状態は [eTLD+1](https://developer.mozilla.org/en-US/docs/Glossary/eTLD) (`*.trap.show`, `*.trap.games`) と、ブラウザごとに保持されます。
技術的な仕組みは、[/SysAd/dev/traefik-forward-auth](https://wiki.trap.jp/teams/SysAd/dev/traefik-forward-auth) のドキュメントを参照してください。

:::

### <a name="path-prefix"></a>(高度な設定) Path Prefix

該当アプリにアクセスできるパスのprefixを指定します。リクエストのパスにprefixについていたときのみ、アプリにリクエストが流されます。

自身が所有するアプリ同士のみ、同じホスト上で違うPath Prefixを重ねる"Path Overlay"が可能です。

例:
- アプリ1 (フロントエンド配信, Static): `https://my-app.trap.show/`
- アプリ2 (バックエンド, Runtime): `https://my-app.trap.show/api`

### (高度な設定) Strip Path Prefix

Path Prefixに `/` 以外が指定されていて、該当アプリにリクエストが流されるとき、Path Prefixをプロキシされたリクエストから除くかどうかを指定します。
例: Path Prefixが `/api` で、ユーザーが `/api/ping` にアクセスしてきたとき、アプリには `/ping` がパスとしてHTTPリクエストが流れてきます。

### (高度な設定) h2c

プロキシからアプリへのHTTP通信で強制的にh2cを用いる場合、指定します。gRPCの通信とかができます。指定しない場合はHTTP/1.1が使用されます。
Runtimeアプリでのみ使用できます。

## (高度な設定) アプリが公開可能な公開側ポート

- 39000/tcp ~ 39999/tcp
- 39000/udp ~ 39999/udp

早いもの勝ちです。

## 自動シャットダウン設定
Runtimeアプリのみ、自動シャットダウンの設定を行うことができます。一定期間外部からのアクセスがないアプリを自動でシャットダウンします。アプリ停止中にアクセスがあると、自動でアプリを起動します。
リソースを節約するため、この設定の有効化を検討してみてください。

- Loading Page
    - Webアプリ向け
    - アプリ起動時にローディングページを表示します
- Blocking
    - APIサーバー向け
    - アプリ起動時にリクエストを待機させ、起動が完了するとリクエストをアプリへリダイレクトします

## SSHでアプリケーションコンテナに入る

Runtimeアプリに対して、

- シェル(`/bin/sh`)で入る
- コマンドを実行する
- メインプロセスにアタッチする

ことができます。

### 1. 自分の公開鍵を登録する

管理画面のユーザー設定画面（上部の「SETTINGS」）から、自分のSSH公開鍵を登録します。

- 例: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIN5GrqmjSFjjHdNmeQMPoRQS4XBZinlTARqQdOQlt5j6 motoki317@gmail.com`

間違って `-----BEGIN OPENSSH PRIVATE KEY-----` などから始まる**秘密鍵を登録しないように**！

### 2. SSHする

SSHしたいRuntimeアプリケーションの詳細画面を開き、SSHコマンドを確認します。

例: `ssh b6f8bdd93b94bc9c1c2fcf@ns.trap.jp -p 2201`
コマンドを実行したい場合は次のように `ssh b6f8bdd93b94bc9c1c2fcf@ns.trap.jp -p 2201 ls -lha`

自分のターミナルから上のコマンドを打って、接続できれば成功です！

## Web上からデータベースの管理をする

:::info

AdminerによるMongoDBのサポートがあまりよろしくないようで、**MariaDB限定**です。

:::

アプリ用に発行されたデータベースの内容を、Web上から管理できます。
NeoShowcaseから左上のアイコンをクリックし「DB Admin」から、もしくは下のURLでアクセスできます。
https://adminer.ns.trap.jp/

アプリに渡された環境変数の情報を用いてログインしてください。

## <a name="precautions"></a>使用上の注意事項

主に**Runtimeアプリ**を利用する上での注意事項です。

- アプリケーション**再起動の度にディレクトリは初期化**されます。
    - ファイルシステム上にデータを保存すると、再起動で消えます。
    - MongoDBまたはMariaDBの利用をおすすめします。
- ホストのメンテナンス等でアプリが**再起動することがあります**。
- **メモリを大量に使用する**アプリは使用できないことがあります。詳しくは以下に。
- アプリは全員の所有者が退部後も**動き続ける保証はできません**。
    - 特にRuntimeアプリはリソースの消費が激しく、サーバーは部費で動いているためです。
    - 退部後は任意のタイミングで停止することがあります。

### リソース制限

NeoShowcaseにデプロイされた**Runtimeアプリ**には、CPUとメモリのリソース制限がかかっています。
これは、コンテナとしてデプロイされたアプリが、ホストのリソースを食いつぶしてしまい、他のアプリやサービス全体に影響を与えることを防ぐためです。

- CPU: 最大1コア
- メモリ: 最大180MiB (物理100MiB + スワップ80MiB)

このため、このリソース制限を超えて、メモリを大量に消費するアプリなどはデプロイできない場合があります。
（実際にデプロイを試みるとOOMで強制再起動といった挙動をする可能性があります）

最新の情報は[設定ファイル](https://github.com/traPtitech/manifest/blob/main/ns-system/config/ns.yaml)から確認できます。

---

## <a name="samples"></a>設定サンプル集

忙しい人のための設定サンプル集

追記はご自由にどうぞ

### github.io 的なことがしたい（静的ファイルを配信したい）

- ビルド設定 → Static Command
    - Base Image → 空
    - Build Command → 空
    - Artifact Path → `.`
    - Single Page Application → チェックをいれない
- サイト設定 → 好きなドメイン名を選ぶ
    - ドメイン名以外の設定はそのまま

リポジトリルート以外の配信をしたい場合、Artifact Pathにリポジトリルートからの相対パスを入れます。

Unity WebGL のビルド済みファイルの配信も、この設定でできます。

### npm run build などでビルド後のファイルを静的配信したい

- ビルド設定 → Static Buildpack
    - Context → `.`
    - Artifact Path → `dist` (静的ファイルが生成されるディレクトリ)
    - Single Page Application → チェックをいれる
- サイト設定 → 好きなドメイン名を選ぶ
    - ドメイン名以外の設定はそのまま

package.json があるディレクトリがリポジトリルート以外のときは、Context にそのディレクトリを指定します。

### Golang や Node.js で書いたサーバーや Bot を動かしたい

- ビルド設定 → Runtime Buildpack
    - Context → `.`
- サイト設定 → サーバーにアクセスできるようにしたい場合、追加
    - 好きなドメイン名を選ぶ
    - サーバーが listen する HTTP Port を設定する

#### Golang サーバーからリポジトリに含まれる静的ファイルを参照したい

使用しているPaketo Buildpacksではデフォルトで含まれないので、以下を環境変数に設定してください。

- `BP_KEEP_FILES`: `./*:./*`
    - https://github.com/paketo-buildpacks/go-build#bp_keep_files

### データベースを使う

- ビルド設定 → Use MariaDB / MongoDB を選ぶ

アプリ作成時に `NS_MARIADB_HOSTNAME` などの形式で接続情報が発行されます。

### traP部員のみが(見れるアプリ|使える管理画面)が作りたい

- サイト設定 → 部員認証 Soft または Hard を選ぶ

アプリ側で HTTP ヘッダー `X-Forwarded-User` をみると、アクセスしてきた部員の traQ ID がわかります。

### APIサーバーとクライアントから成るサービスを作りたい

サーバー（バックエンド）とクライアント（フロントエンド）は、別アプリとしてデプロイしてください。
この上で、必要な場合は [Path Overlay](#path-prefix) を利用してください。

例えばサーバーが `/api` 以下のパスで待ち受けていて、クライアントが同じドメイン（正確には、同じホスト）以下の API を叩くことを想定する場合、次のサイト設定をします。

- サイト設定 (サーバー)
    - 好きなドメイン名を選ぶ
    - Path Prefix → `/api`
- サイト設定 (クライアント)
    - バックエンドと同じドメイン名を選ぶ
    - Path Prefix → `/`

### docker compose のアプリを移したい

docker compose でどのようなコンテナを使っているかにも依りますが、基本的に「1 コンテナ = 1 アプリ」としてデプロイしてください。

1 コンテナ（アプリ）につき基本 1 プロセスがベストプラクティスです。
NeoShowcase も裏ではコンテナ技術がベースとなっているため、これに従うとスムーズです。
<https://docs.docker.com/config/containers/multi-service_container/#:~:text=It%27s%20best%20practice,your%20overall%20application.>

また、データベースなどの別サービスに、メインのアプリが依存している場合もあると思います。

- 大量のメモリを必要とするサービス（検索エンジン、インメモリキャッシュ等）
- ディスクの永続化を必要とするサービス（だいたいのデータベースサービス）

これらは別アプリとして建てるの**ではなく**、NeoShowcase ビルトインの MariaDB / MongoDB データベース発行機能を使うか、外部のサービスの利用を検討してください。

---

## 舞台裏

舞台裏を知りたい開発者向けドキュメントはこっち https://wiki.trap.jp/teams/SysAd/dev/NeoShowcase/

### 旧Showcaseとの差分

- `showcase.yaml` は旧Showcaseで必要とされていたファイル
    - 一切見ていない + 古いアプリは自動で移行されている
    - したがって、そのまま削除してよい
- mysql/mongoDBの環境変数名が変わっている
    - 移行時に古いものも自動で設定されている

### その他

その他質問などあれば `#services/feedback` 等へどうぞ。
