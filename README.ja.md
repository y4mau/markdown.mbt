# @y4mau/markdown

JavaScript/MoonBit 向け CST ベースのインクリメンタル Markdown パーサー。

> **[mizchi/markdown.mbt](https://github.com/mizchi/markdown.mbt) のフォーク** — ローカルファイル編集・プレビュー・Claude Code 連携などのプレイグラウンド機能を追加しています。

## フォーク独自機能

上流リポジトリに加えて、以下の機能を追加しています：

- **ローカルファイル I/O 対応プレイグラウンド** — `?file=<path>` でローカル `.md` ファイルを読み込み、自動保存・ステータス表示・ウィンドウフォーカス時の同期に対応
- **クリップボードコピー** — ツールバーからドキュメント全体のコピー、コードブロック単位のコピー、見出しセクション単位のコピー（見出しホバーで表示、セクションハイライト付き）
- **Mermaid ダイアグラム描画** — `mermaid` 言語指定のフェンスドコードブロックをダイアグラムとして描画（ズーム・パン操作対応）
- **Details/summary トグル** — HTML `<details>` / `<summary>` ブロックを折りたたみセクションとして描画
- **プレビュー→ソース ナビゲーション** — プレビュー要素をクリックするとエディタ上の対応箇所にジャンプ。プレビュー内のテキスト選択は維持されます
- **URL ペーストでリンク作成** — テキストを選択して URL をペーストすると `[テキスト](url)` 形式のリンクを自動作成

## クイックセットアップ

### 前提条件

- [Node.js](https://nodejs.org/) (v18+)
  - Linux / macOS: `curl -fsSL https://fnm.vercel.app/install | bash && fnm install --lts`
  - Windows: `winget install Schniz.fnm` then `fnm install --lts`
- [pnpm](https://pnpm.io/) — `npm install -g pnpm`
- [MoonBit](https://www.moonbitlang.com/download/)
  - Linux / macOS: `curl -fsSL https://cli.moonbitlang.com/install/unix.sh | bash`
  - Windows: `irm https://cli.moonbitlang.com/install/powershell.ps1 | iex`

### Bash (Linux / WSL / macOS)

```bash
git clone https://github.com/y4mau/markdown.mbt.git
cd markdown.mbt
pnpm install
moon build --target js
./scripts/install-mdpreview.sh                    # スキル＋シェル関数をインストール
source ~/.bashrc
pnpm exec vite &                                  # 開発サーバーをバックグラウンドで起動
sleep 2
open http://localhost:5173/?file=$PWD/README.md   # README をプレビュー
```

### PowerShell (Windows)

```powershell
git clone https://github.com/y4mau/markdown.mbt.git
cd markdown.mbt
pnpm install
moon build --target js
.\scripts\install-mdpreview.ps1                   # スキル＋シェル関数をインストール
Start-Process pnpm "exec vite"                    # 開発サーバーをバックグラウンドで起動
Start-Sleep 2
Start-Process "http://localhost:5173/?file=$($PWD.Path)/README.md"  # README をプレビュー
```

## Claude Code 連携

`mdpreview` スキルを使うと、Claude Code からローカルの `.md` ファイルをプレイグラウンドのブラウザプレビューで開けます。

### セットアップ

1. 下記のスキル定義を `~/.claude/skills/mdpreview/SKILL.md` にコピー
2. 開発サーバーを起動: `pnpm vite`
3. Claude Code で `/mdpreview <file>` または自然言語で指示

### サンプルプロンプト

```
README.md をプレビューして
```
```
docs/markdown.md をプレイグラウンドで表示して
```
```
my-notes.md をブラウザで開いて
```

### SKILL.md

<details>
<summary><code>~/.claude/skills/mdpreview/SKILL.md</code> にコピー</summary>

```markdown
---
name: mdpreview
description: Open a markdown file in the markdown.mbt playground browser preview. Use when the user asks to show, preview, or view a markdown file.
argument-hint: <file-path>
allowed-tools: Bash, Glob, Read
---

# Open Markdown in Playground Preview

Open the specified markdown file in the markdown.mbt playground running at `http://localhost:5173/`.

## Prerequisites

The dev server must be running:

cd ~/ghq/github.com/y4mau/markdown.mbt && pnpm vite

## Steps

1. Resolve the file path to an absolute path
2. Verify the file exists and has a markdown extension (`.md`, `.markdown`, `.txt`)
3. Open in the browser:

# WSL
cmd.exe /c start "" "http://localhost:5173/?file=<absolute-path>"
# Linux
xdg-open "http://localhost:5173/?file=<absolute-path>"

If `$ARGUMENTS` is empty, search the current directory for markdown files and ask the user which one to open.

## Notes

- The playground supports any file on the local filesystem (absolute paths)
- The browser tab title updates to the filename
- Extension allowlist on the server: `.md`, `.markdown`, `.txt`
```

</details>

## プレイグラウンド

```bash
pnpm install
moon build --target js
pnpm exec vite
```

## 上流の機能

API の詳細（JavaScript、MoonBit、TypeScript、インクリメンタルパース）は上流リポジトリを参照: [mizchi/markdown.mbt](https://github.com/mizchi/markdown.mbt)

主な特徴：

- **高速インクリメンタルパース** — 変更されたブロックのみ再パース（最大 42 倍高速）
- **ロスレス CST** — 空白・マーカー・フォーマットをすべて保持
- **GFM サポート** — テーブル、タスクリスト、取り消し線
- **クロスプラットフォーム** — JS、WASM-GC、ネイティブターゲット対応
- **mdast 互換** — AST は [mdast](https://github.com/syntax-tree/mdast) 仕様に準拠

### パフォーマンス

| ドキュメント | フルパース | インクリメンタル | 高速化率 |
|----------|-----------|-------------|---------|
| 10 段落 | 68.89µs | 7.36µs | 9.4x |
| 50 段落 | 327.99µs | 8.67µs | 37.8x |
| 100 段落 | 651.14µs | 15.25µs | 42.7x |

## CommonMark 互換性

このパーサーは一般的な Markdown 構文を正しく処理し、ドキュメント・ブログ記事・メモなどの典型的なユースケースで問題なく動作します。一部のエッジケースは完全な CommonMark 準拠ではありません。厳密な準拠が必要な場合は [cmark.mbt](https://github.com/moonbit-community/cmark.mbt) を検討してください。

## ドキュメント

詳細なアーキテクチャと設計については [docs/markdown.md](./docs/markdown.md) を参照してください。

## ライセンス

MIT
