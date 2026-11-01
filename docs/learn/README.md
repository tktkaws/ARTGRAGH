# グラフビューを作るためのライブラリ入門

対象は、HTML・CSS・JavaScriptの基本を学んだフロントエンドエンジニアです。対応する学習ページでは、説明とコード例を読み、その直後のデモで試す順番で学べます。このフォルダのMarkdownは、GitHubでも読める補足ノートです。

| 解説 | デモURL | 学ぶこと |
| --- | --- | --- |
| [force-graphの基礎](./force-graph.md) | `/learn/force-graph/` | 点と線の描画、選択、ズーム、ドラッグ、色分け、絞り込み |
| [d3-forceの基礎](./d3-force.md) | `/learn/d3-force/` | 座標と速度、反発力、リンクの力、中心力、tick、計算の停止・再開 |

force-graphは描画と操作を扱い、内部の配置計算にd3-forceを使います。d3-force自体は位置を計算するライブラリで、画面へ描く処理は別に必要です。

デモはA〜Fの6ノードと6リンクを共通データにしています。美術館の作品情報や、作品探索で保存した設定とは独立しています。

## デモを開く

リポジトリのルートで、依存関係を準備してから起動します。

```sh
npm ci
npm run dev -- --background
```

起動時に表示されたURLに、表のURLを付けてアクセスしてください。ブラウザ上部のタブから、2つの学習ページを切り替えられます。force-graphは3段階、d3-forceは4段階で、それぞれの説明の下に独立したデモがあります。補足ノートは各ページ末尾からダウンロードできます。

```sh
npm run astro -- dev status
npm run astro -- dev logs
npm run astro -- dev stop
```

## ファイルの対応

| ファイル | 役割 |
| --- | --- |
| [force-graph.md](./force-graph.md)・[d3-force.md](./d3-force.md) | GitHubで読める補足ノート |
| [force-graph.astro](../../src/pages/learn/force-graph.astro) | force-graphのデモページ |
| [d3-force.astro](../../src/pages/learn/d3-force.astro) | d3-forceのデモページ |
| [learn-force-graph.ts](../../src/scripts/learn-force-graph.ts) | Canvas描画、操作、検索・フィルタ |
| [learn-d3-force.ts](../../src/scripts/learn-d3-force.ts) | d3-forceの制御と、計算結果のSVG描画 |
| [d3-simulation.ts](../../src/lib/learn/d3-simulation.ts) | d3-forceの生成と力の設定 |
| [force-graph-demo.ts](../../src/lib/learn/force-graph-demo.ts) | 共通のノード・リンクと初期値 |
| [LessonStep.astro](../../src/components/learn/LessonStep.astro) | 説明、コード例、試す操作、デモを順に配置する共通構造 |

この`docs/learn/`はGitの除外対象ではありません。GitHubでも、リポジトリのREADMEからリンクをたどって読める構成です。
