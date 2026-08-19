# musikaroid-discord-bot

Musikaroid Records の Discord サーバー向けの受け入れ自動化 Bot。
`/join` スラッシュコマンドから Founder 承認制でプライベート手続きチャンネル
（`所属手続きno{連番}`）を作成し、定型文の投稿・ピン留め・スレッド自動作成まで行う。

## 動作フロー

1. 新メンバーが `#はじめに` で `/join` を実行（**Layer 1**: そのチャンネルでしか出さない、Discord のコマンド権限で制限）
2. Bot が **Layer 2** でロールをチェック — Founder / Artist はブロック（ephemeral 案内のみ）
3. 通過したら **Layer 3**: Founder に承認 DM を送付、実行者には ephemeral で「受付ました」
4. Founder が **承認** ボタン → プライベートチャンネル作成 → 定型文投稿・ピン留め → スレッド 5 本自動作成 → 実行者に ephemeral で案内
5. Founder が **却下** ボタン → 何も作らない、実行者にも通知しない（気まずさ回避）
6. ボタンは押された時点で disabled 化（二重作成防止）

## セットアップ

### 1. Discord Developer Portal
1. <https://discord.com/developers/applications> で New Application → Bot 作成
2. **Bot タブ**で Token を発行（`DISCORD_TOKEN`）。Message Content Intent は不要
3. **General Information** の Application ID をメモ（`DISCORD_CLIENT_ID`）
4. **OAuth2 → URL Generator**: Scopes に `bot` と `applications.commands`、Bot Permissions に以下を選択:
   - Manage Channels
   - Manage Roles（将来 Artist ロール自動付与時に必要、現状は無くても動く）
   - Send Messages
   - Manage Messages（ピン留めに必要）
   - Create Public Threads
   - Manage Threads
   - Read Message History
   - View Channels
5. 発行された URL でサーバーに Bot を招待

### 2. 環境変数（Railway or ローカル）
`.env.example` をコピーして `.env` を作成し、以下を埋める（Railway ではダッシュボードから設定）:

```
DISCORD_TOKEN=…
DISCORD_CLIENT_ID=…
GUILD_ID=…                    # サーバーID
FOUNDER_ROLE_ID=…             # 「Founder」ロールのID
ARTIST_ROLE_ID=…              # 「Artist」ロールのID
FOUNDER_USER_ID=…             # 承認DMを受け取るユーザーID (澄さん)
ONBOARDING_CATEGORY_ID=…      # 「手続き」カテゴリのID
```

Discord のロール/チャンネル/ユーザーの ID は、開発者モードを ON にして右クリック → 「ID をコピー」。

### 3. 定型文の投入
`config/onboarding.json` の `body_ja` / `body_en` を、実際に音色さんに送った文面に差替える。
`thread_names` は現運用（no2）の表記通り 5 本。触らなくて可。

### 4. スラッシュコマンド登録（初回・コマンド定義を変更した時のみ）
ローカルで一度だけ:
```
npm install
npm run register
```
Guild スコープなので即反映。

### 5. デプロイ (Fly.io 推奨)

Bot は HTTP を持たない常駐プロセス。Fly.io の `shared-cpu-1x` / 256MB (無料枠) で常時起動。
`fly.toml` と `Dockerfile` は同梱済。

```bash
# ① flyctl インストール (未導入なら)
curl -L https://fly.io/install.sh | sh

# ② ログイン
fly auth login

# ③ リポジトリを clone (or 既に clone 済ならその中で)
git clone https://github.com/sumi-music/musikaroid-discord-bot
cd musikaroid-discord-bot

# ④ アプリ作成 (同梱の fly.toml を採用、デプロイはまだしない)
fly launch --copy-config --no-deploy --name musikaroid-discord-bot --region nrt

# ⑤ シークレット (7つの env vars) をまとめて登録
fly secrets set \
  DISCORD_TOKEN='...' \
  DISCORD_CLIENT_ID='...' \
  GUILD_ID='...' \
  FOUNDER_ROLE_ID='...' \
  ARTIST_ROLE_ID='...' \
  FOUNDER_USER_ID='...' \
  ONBOARDING_CATEGORY_ID='...'

# ⑥ デプロイ
fly deploy

# ⑦ ログ確認 (Ctrl+C で抜ける)
fly logs
```

起動ログに `ready as ...` が出れば OK。以後、`git push` 後に `fly deploy` を実行して反映。

**代替: Railway** — `railway.json` も同梱してあります。Railway ダッシュボードで GitHub Repo 連携 → Variables に env vars を貼るだけで動きます (今回は OAuth 不調により選外)。

### 6. Layer 1（コマンド可視性）を Founder が設定
Discord サーバーの設定 → Integrations → Bot → `/join` の権限を **`#はじめに` チャンネルのみ許可** に変更。他チャンネルではコマンド一覧に出なくなる。

## ローカル動作確認
```
cp .env.example .env
# .env を埋める
npm install
npm run register    # 初回のみ
npm start
```
別のディスコード検証サーバーで挙動確認 → 問題なければ本番に置き換え。

## 将来拡張 (今回は実装しない)
- Artist ロールの自動付与（承認後）
- 覚書 PDF の DM 送付
- `artists.json` エントリの下書き生成

## セキュリティ / 運用メモ
- `DISCORD_TOKEN` はコミット禁止（`.gitignore` で `.env` 除外）
- 承認ボタンは Founder のみ操作可（`FOUNDER_USER_ID` チェック）
- 既存の `所属手続きno{N}` チャンネルに実行者の閲覧許可があれば、重複作成せず既存へ案内

## ライセンス
MIT。詳細は [LICENSE](./LICENSE)。
