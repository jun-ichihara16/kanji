# ClaudeCode 修正プロンプト — KANJI index.html FB反映

以下の修正を `index.html` に適用してください。
既存のHTMLの構造・スタイルは維持し、指定箇所のみ変更すること。

---

## 修正リスト（全6件）

---

### 修正1：バッジのテキスト変更

**場所：** ヒーローセクション `.hero-badge`

**変更前：**
```html
幹事アプリ｜2025年版
```

**変更後：**
```html
幹事アプリ｜2026年版
```

---

### 修正2：幹事特典セクションのサブコピーを改行

**場所：** `#panel-reward` の `.section-title p`

**変更前：**
```html
<p>5万円以上の飲み会を幹事するたびにポイントが貯まる。貯まったポイントで、友達を誘える口実をゲット。</p>
```

**変更後：**
```html
<p>5万円以上の飲み会を幹事するたびにポイントが貯まる。<br>貯まったポイントで、友達を誘える特典をゲット。</p>
```

---

### 修正3：特典カードの「口実」行を削除

**場所：** `#panel-reward` の `.reward-card` 3枚すべて

以下の要素を各カードから削除する：

```html
<div class="excuse">口実：「お疲れ様会」「誕生日」</div>
```
```html
<div class="excuse">口実：「BBQしよう」「夏に行こう」</div>
```
```html
<div class="excuse">口実：「旅行しよう」「記念日」</div>
```

---

### 修正4：ロードマップのトラックタブを削除

**場所：** `#panel-roadmap` の `.roadmap-tracks` ブロック全体を削除

**削除対象：**
```html
<div class="roadmap-tracks">
  <span class="track t1">割り勘トラック</span>
  <span class="track t2">連絡ツールトラック</span>
  <span class="track t3">プラットフォームトラック</span>
</div>
```

---

### 修正5：フェーズの絵文字をアイコン画像に置き換え

**場所：** `#panel-roadmap` の各 `.roadmap-card` の `.phase` テキスト

各フェーズの絵文字を `<img>` タグに置き換える。サイズは `width="20" height="20"` で、テキストと縦位置を揃えること（`vertical-align: middle`）。

**変更前 → 変更後：**

```html
<!-- Phase 1 -->
Phase 1 ✅ 現在
↓
<img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663454524748/B4UK74oTCYxrZdn2aFUJCd/kanji-phase1-icon-5rmborEoS2fHE3GXMgTbfX.png" width="20" height="20" style="vertical-align:middle;margin-right:6px;" alt=""> Phase 1 現在進行中

<!-- Phase 2 -->
Phase 2 🔜 次のステップ
↓
<img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663454524748/B4UK74oTCYxrZdn2aFUJCd/kanji-phase2-icon-euU8gHmVGMB8KTYZEaA4UA.png" width="20" height="20" style="vertical-align:middle;margin-right:6px;" alt=""> Phase 2 次のステップ

<!-- Phase 3 -->
Phase 3 📋 計画中
↓
<img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663454524748/B4UK74oTCYxrZdn2aFUJCd/kanji-phase3-icon-9vDqr7vYN9PuLQkUrLkL2v.png" width="20" height="20" style="vertical-align:middle;margin-right:6px;" alt=""> Phase 3 計画中

<!-- Phase 4 -->
Phase 4 🚀 ビジョン
↓
<img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663454524748/B4UK74oTCYxrZdn2aFUJCd/kanji-phase4-icon-oHiTD88hsM2zpcguSrfmyq.png" width="20" height="20" style="vertical-align:middle;margin-right:6px;" alt=""> Phase 4 ビジョン
```

---

### 修正6：「想い」セクションを新規追加

#### 6-1. タブバーに「想い」タブを追加

**場所：** `.tab-bar` 内の `FAQ` タブの直前に追加

```html
<button class="tab-btn" data-tab="story">想い</button>
```

#### 6-2. モバイルドロワーに「想い」リンクを追加

**場所：** `#mobileDrawer` 内の FAQ リンクの直前に追加

```html
<a href="#" data-tab="story">
  <span class="tab-icon">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
    </svg>
  </span>
  想い
</a>
```

#### 6-3. 「想い」パネルを新規追加

**場所：** `#panel-faq` の直前に挿入

```html
<!-- STORY -->
<div class="tab-panel" id="panel-story">
  <div class="section-title">
    <h2>なぜ、KANJIを作ったのか</h2>
  </div>
  <div class="story-body">
    <div class="story-accent-line"></div>
    <div class="story-content">
      <p class="story-lead">「幹事って、損な役回りだよな」</p>
      <p>社会人になってから、飲み会の幹事をやる機会が増えた。お店を探して、日程を調整して、参加者を集めて、お金を集めて、割り勘して、催促して——。やることが多い割に、誰にも感謝されない。</p>
      <p>「次は誰かやってよ」と思いながらも、結局また自分が幹事になる。そんな経験を何度も繰り返すうちに、「これ、もっとラクにできるはずだ」と思うようになった。</p>
      <p>KANJIは、幹事が「またやりたい」と思えるようにするためのアプリです。ラクになるだけじゃなく、やるほど得をする。そんな体験を作りたくて、このアプリを作り始めました。</p>
      <div class="story-sign">KANJI 開発者</div>
    </div>
  </div>
</div>
```

#### 6-4. 「想い」セクションのCSSを追加

**場所：** `<style>` タグ内の末尾（`</style>` の直前）に追加

```css
/* ===== STORY ===== */
.story-body{display:flex;gap:0;max-width:680px;margin:0 auto}
.story-accent-line{width:4px;background:var(--green);border-radius:4px;flex-shrink:0;margin-right:32px}
.story-content p{color:var(--sub);font-size:1rem;line-height:2;margin-bottom:24px}
.story-content p:first-child{font-size:1.25rem;font-weight:700;color:var(--text);line-height:1.7}
.story-lead{font-size:1.25rem!important;font-weight:700!important;color:var(--text)!important}
.story-sign{text-align:right;font-size:.9rem;color:var(--sub);margin-top:8px;font-style:italic}
@media(max-width:600px){
  .story-accent-line{margin-right:20px}
  .story-content p{font-size:.95rem}
}
```

---

## フッターの年号修正

**場所：** `<div class="footer-copy">` 内

**変更前：**
```html
© 2025 KANJI
```

**変更後：**
```html
© 2026 KANJI
```

---

## FAQ内の年号修正

**場所：** 「幹事特典はいつから使えますか？」の回答

**変更前：**
```html
2025年後半のPhase 2から提供開始予定です。
```

**変更後：**
```html
2026年10月〜のPhase 3から提供開始予定です。
```

---

## 注意事項

- 上記以外の箇所は一切変更しないこと
- 既存のCSSクラス・JS・構造はすべて維持すること
- 修正後のファイルを `index.html` として出力すること
