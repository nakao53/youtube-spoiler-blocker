// フィルタリング設定の状態
let filterEnabled = true;
let filterKeywords = [];
let blurEnabled = true;
let blurAmount = 10;
let hideShorts = true; // ショート動画を非表示にする設定

// コンテキスト分析用の定数
const CONTEXT_PATTERNS = {
  WARNING: /ネタバレ|spoiler|注意|ばれ|結末|バレ/i,
  REVIEW: /レビュー|感想|review|考察/i,
  IMPORTANT: /最終回|final|エンディング|決着|結末|完結|終わり/i,
  EPISODE: /第?\d+話|ep\d+|episode\d+/i
};

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
    keywords: [],
    hideShorts: true
  });
  filterEnabled = settings.enabled;
  blurEnabled = settings.enableBlur;
  blurAmount = settings.blurAmount;
  filterKeywords = settings.keywords;
  hideShorts = settings.hideShorts;
  processPage();
}

// コンテキスト分析関数
function analyzeContext(element) {
  const title = element.querySelector('#video-title')?.textContent || '';
  const description = element.querySelector('#description')?.textContent || '';
  const channelName = element.querySelector('#channel-name')?.textContent || '';

  return {
    hasWarning: CONTEXT_PATTERNS.WARNING.test(title),
    isReview: CONTEXT_PATTERNS.REVIEW.test(title),
    isImportant: CONTEXT_PATTERNS.IMPORTANT.test(title),
    hasEpisodeNumber: CONTEXT_PATTERNS.EPISODE.test(title),
    channelName: channelName
  };
}

// フィルター強度の計算
function calculateFilterStrength(context, keyword) {
  let strength = 0;

  // 警告表現があれば強度を上げる
  if (context.hasWarning) strength += 2;
  
  // レビューや感想の場合
  if (context.isReview) strength += 1;
  
  // 最終回や重要な回の場合
  if (context.isImportant) strength += 2;
  
  // エピソード番号がある場合
  if (context.hasEpisodeNumber) strength += 1;

  return Math.min(strength, 4); // 最大強度は4
}

// 動画要素をフィルタリング
function filterVideoElement(element) {
  if (!element) return;

  // ショート動画かどうかを判定
  const isShort = element.querySelector('a[href^="/shorts/"]') !== null;
  
  // ショート動画は非表示
  if (hideShorts && isShort) {
    element.style.display = 'none';
    return;
  }

  if (!filterEnabled) return;

  const titleElement = element.querySelector('#video-title, .ytd-video-renderer');
  if (!titleElement) return;

  const title = titleElement.textContent;
  const context = analyzeContext(element);
  
  // キーワードマッチングとコンテキスト分析
  const matchedKeyword = filterKeywords.find(keyword => 
    title.toLowerCase().includes(keyword.toLowerCase())
  );

  if (matchedKeyword) {
    const filterStrength = calculateFilterStrength(context, matchedKeyword);
    
    if (filterStrength > 0) {
      if (blurEnabled) {
        // フィルター強度に応じてぼかしを調整
        const adjustedBlurAmount = Math.floor(blurAmount * (filterStrength / 4));
        element.style.setProperty('--blur-amount', `${adjustedBlurAmount}px`);
        element.classList.add('spoiler-blur');
        
        // ツールチップで理由を表示
        const reasons = [];
        if (context.hasWarning) reasons.push('ネタバレの可能性');
        if (context.isReview) reasons.push('レビュー/感想');
        if (context.isImportant) reasons.push('重要な回');
        if (context.hasEpisodeNumber) reasons.push('エピソード情報');
        
        element.title = `フィルター理由: ${reasons.join(', ')}`;
      } else {
        element.style.display = 'none';
      }
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
    const settings = message.settings;
    filterEnabled = settings.enabled;
    filterKeywords = settings.keywords;
    blurEnabled = settings.enableBlur;
    blurAmount = settings.blurAmount;
    hideShorts = settings.hideShorts;
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
