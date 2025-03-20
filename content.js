// フィルタリング設定の状態
let filterEnabled = true;
let filterKeywords = [];
let blurEnabled = true;
let blurAmount = 10;

// CSSスタイルを追加
const style = document.createElement('style');
document.head.appendChild(style);
style.textContent = `
  .spoiler-blur {
    filter: blur(var(--blur-amount)) !important;
    transition: filter 0.3s;
  }
  .spoiler-blur:hover {
    filter: blur(0) !important;
  }
`;

// 設定を読み込む
async function loadSettings() {
  const settings = await chrome.storage.sync.get({
    enabled: true,
    enableBlur: true,
    blurAmount: 10,
    keywords: []
  });
  filterEnabled = settings.enabled;
  blurEnabled = settings.enableBlur;
  blurAmount = settings.blurAmount;
  filterKeywords = settings.keywords;
  processPage();
}

// 動画要素をフィルタリング
function filterVideoElement(element) {
  if (!filterEnabled || !element) return;

  // タイトル要素を取得（複数のパターンに対応）
  const titleElement = element.querySelector('#video-title, .ytd-video-renderer');
  if (!titleElement) return;

  const title = titleElement.textContent.toLowerCase();
  const hasBlockedKeyword = filterKeywords.some(keyword => 
    title.includes(keyword.toLowerCase())
  );

  if (hasBlockedKeyword) {
    if (blurEnabled) {
      // サムネイル画像要素を取得
      const thumbnail = element.querySelector('#thumbnail img, .ytd-thumbnail img');
      if (thumbnail) {
        element.style.setProperty('--blur-amount', `${blurAmount}px`);
        thumbnail.classList.add('spoiler-blur');
      }
      // タイトルもぼかす
      titleElement.style.setProperty('--blur-amount', `${blurAmount}px`);
      titleElement.classList.add('spoiler-blur');
    } else {
      // ぼかしが無効の場合は非表示
      element.style.display = 'none';
    }
  } else {
    // ブロック対象でない場合、スタイルをリセット
    element.style.display = '';
    const thumbnail = element.querySelector('#thumbnail img, .ytd-thumbnail img');
    if (thumbnail) {
      thumbnail.classList.remove('spoiler-blur');
    }
    titleElement.classList.remove('spoiler-blur');
  }
}

// ページ全体を処理
function processPage() {
  // 動画要素を含む可能性のある要素のセレクタ
  const selectors = [
    'ytd-video-renderer',
    'ytd-grid-video-renderer',
    'ytd-compact-video-renderer'
  ];

  selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(filterVideoElement);
  });
}

// 動的に追加される要素を監視
const observer = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType === 1) { // ELEMENT_NODE
        // 新しく追加された要素が動画要素かその親要素である可能性がある
        filterVideoElement(node);
        // 子要素も確認
        node.querySelectorAll('ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer')
          .forEach(filterVideoElement);
      }
    });
  });
});

// 設定変更のメッセージを受信
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SETTINGS_CHANGED') {
    filterEnabled = message.settings.enabled;
    blurEnabled = message.settings.enableBlur;
    blurAmount = message.settings.blurAmount;
    processPage();
  }
});

// 監視の開始
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// 初期設定を読み込む
loadSettings();
