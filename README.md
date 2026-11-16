# switchbot-logger

SwitchBot の温湿度計の温度・湿度を MariaDB に蓄積し、viewer でデバイス別に確認するツールです。複数の SwitchBot アカウントと複数のデバイスに対応しています。

## 構成

| コンテナ | 役割 |
| --- | --- |
| `logger` | SwitchBot API から温度・湿度を定期取得して DB に保存する |
| `viewer` | 蓄積したデータをデバイス別にグラフ表示する (`http://localhost:8080`) |
| `mariadb` | データの保存先 |

`logger` と `viewer` は、同じ `config.json` をマウントして読みます。

## config.json

`config.json` はリポジトリ直下に置き、`docker-compose.yml` で `logger` と `viewer` にマウントされます。**アカウントやデバイスの追加は、このファイルを編集するだけで完結します。コードの変更、イメージの再ビルド、コンテナの再作成は不要です。**

### 配列形式 (推奨)

```json
{
  "accounts": [
    {
      "name": "home",
      "token": "<SwitchBot の token>",
      "secret": "<SwitchBot の secret>",
      "intervalSeconds": 60,
      "devices": ["<deviceId>"]
    },
    {
      "name": "green",
      "token": "<共有ホーム所有アカウントの token>",
      "secret": "<共有ホーム所有アカウントの secret>",
      "intervalSeconds": 60,
      "excludeDevices": ["<取得しない deviceId>"]
    }
  ],
  "legacyDeviceId": "<既存データの deviceId>",
  "db": {
    "host": "mariadb",
    "port": 3306,
    "username": "switchbot-logger",
    "password": "<DB パスワード>",
    "database": "switchbot-logger",
    "type": "mysql"
  }
}
```

| 項目 | 必須 | 説明 |
| --- | --- | --- |
| `accounts[].name` | はい | アカウントの表示名。ログに出力される。重複不可 |
| `accounts[].token` | はい | SwitchBot アプリで発行した token |
| `accounts[].secret` | いいえ | 指定すると API v1.1 (署名認証) で呼び出す。未指定なら v1.0 |
| `accounts[].intervalSeconds` | いいえ | 取得間隔 (秒)。既定は 60。API 上限を超える場合は自動的に引き上げられる (後述) |
| `accounts[].devices` | いいえ | 指定すると自動検出を行わず、この deviceId のみを取得する。自動検出の対象外のタイプも、ここで指定すれば取得を試みる |
| `accounts[].excludeDevices` | いいえ | 自動検出の結果から除外する deviceId |
| `legacyDeviceId` | いいえ | 複数デバイス対応前に蓄積された行 (`device_id` が空) に付与する deviceId |
| `db` | はい | DB の接続設定 |

`devices` を指定しない場合は、アカウントのデバイス一覧 (`GET /devices`) から、温湿度を持つタイプ (Meter、Meter Plus、Meter Pro、防水温湿度計、Hub 2 など) を自動で取得対象にします。deviceId は `docker compose exec logger pnpm start --get-devices` (`logger` の起動中に実行する) で確認できます。

### 従来の単一形式

従来の形式もそのまま使えます。

```json
{
  "token": "<SwitchBot の token>",
  "deviceId": "<deviceId>",
  "db": {
    "host": "mariadb",
    "port": 3306,
    "username": "switchbot-logger",
    "password": "<DB パスワード>",
    "database": "switchbot-logger",
    "type": "mysql"
  }
}
```

`accounts` が無い場合に、この形式として扱われます。名前が `default` のアカウント 1 つ、取得対象は `deviceId` のみ、`legacyDeviceId` は `deviceId` と同じ値になります。`accounts` がある場合は `accounts` が優先され、`token` と `deviceId` は無視されます。

### 設定の反映

`logger` は 10 秒ごとに `config.json` を読み直します。

- `accounts` (追加・削除・各項目の変更) は、再起動なしで次の周期から反映されます。
- `db` と `legacyDeviceId` の変更は、`logger` の再起動 (`docker compose restart logger`) が必要です。`viewer` の `db` の変更も同様です。
- 保存途中などで JSON が壊れていた場合は、直前の正しい設定で動作を続け、エラーをログに出力します。起動時に不正な場合は、エラーを出力して終了します。

## 手順: アカウントやデバイスを追加する

1. `config.json` の `accounts` に、`name` と `token` (必要なら `secret`) を持つ要素を追加して保存する。
2. 数十秒以内にログに `[<name>] N devices, interval ...` が出力され、デバイスの蓄積が始まる。
3. viewer の画面右上のセレクトボックスで、追加したデバイスを選べる。

## API 上限と取得間隔

SwitchBot API はアカウントあたり 1 日 10,000 回が上限です。`logger` は 1 周期でデバイス 1 台につき 1 回の呼び出しを行うため、アカウントごとの実効間隔を次のように決めます。

```
実効間隔 (秒) = max(intervalSeconds, ceil(86400 × 対象台数 / (9000 − 24)))
```

9,000 はデバイス一覧の取得 (1 日 24 回) と再試行などの余裕を見込んだ予算です。たとえば 7 台のアカウントでは、`intervalSeconds` が 60 でも 68 秒に引き上げられます (1 日約 8,900 回)。引き上げられた場合は警告がログに出力されます。

## データベースの移行

起動時に `temparature` と `humidity` の両テーブルへ `device_id` と `device_name` の列が自動で追加されます。既存の行は、`legacyDeviceId` (従来形式では `deviceId`) の行として `device_id` が埋められます。

- `legacyDeviceId` を誤った deviceId にすると、既存の行が誤ったデバイスとして記録されます。必ず、従来から蓄積していたデバイスの ID を指定してください。
- `legacyDeviceId` が無く `device_id` が空の行がある場合は、警告がログに出力され、viewer には「不明」デバイスとして表示されます。

### ロールバック時の注意

旧バージョンの `logger` / `viewer` は、起動時にスキーマを同期するため、`device_id` / `device_name` の列と索引を削除します。温度・湿度の値の行は残りますが、新バージョンの稼働中に蓄積した、デバイスを区別する情報は失われます。旧バージョンに戻す場合は、事前にテーブルのダンプを取得してください。

```
docker compose exec mariadb mariadb-dump -uroot -p switchbot-logger temparature humidity > backup.sql
```

## 開発

`logger` と `viewer` はそれぞれ pnpm のプロジェクトです。

```
cd logger
pnpm install
pnpm test      # 単体テスト
pnpm lint      # prettier / eslint / tsc
```

`viewer` は `pnpm lint` のみです。
