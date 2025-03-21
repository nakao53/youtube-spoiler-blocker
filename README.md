# YouTube Spoiler Blocker

YouTubeの動画一覧からネタバレを含む可能性のある動画を自動的にフィルタリングするChrome拡張機能です。

## 機能

- キーワードベースのフィルタリング
- サムネイルとタイトルのぼかし効果
- ぼかしの強さをカスタマイズ可能
- ホバーでぼかしを一時的に解除
- フィルタリングのON/OFF切り替え

## インストール方法

1. このリポジトリをクローンまたはダウンロード
2. Chromeで `chrome://extensions` を開く
3. 右上の「デベロッパーモード」をオンにする
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. ダウンロードしたフォルダを選択

## 使い方

1. 拡張機能をインストール後、Chromeツールバーのアイコンをクリック
2. フィルタリングしたいキーワードを入力（例：「ネタバレ」「最終回」など）
3. 「追加」ボタンでキーワードを登録
4. YouTubeを開くと、登録したキーワードを含む動画が自動的にぼかされます

## カスタマイズ

- フィルター機能のON/OFF
- ぼかし機能のON/OFF
- ぼかしの強さ調整（2px～20px）

## 開発者向け情報

### 技術スタック

- JavaScript
- Chrome Extension API
- CSS3 (フィルター効果)

### ファイル構成

- `manifest.json`: 拡張機能の設定ファイル
- `popup.html`: 設定画面のUI
- `popup.js`: 設定画面の制御
- `content.js`: YouTubeページでの処理
- `images/`: アイコンファイル

## ライセンス

MIT License
