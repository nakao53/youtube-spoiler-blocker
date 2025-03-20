// フィルタリング設定の状態
let filterEnabled = true;
let filterKeywords = [];
let blurEnabled = true;
let blurAmount = 10;
let hideShorts = true; // ショート動画を非表示にする設定
let enableAI = true;
let huggingFaceToken = '';

// リクエストの制限（無料枠を考慮）
const API_RATE_LIMIT = {
  maxRequests: 30000, // 月間制限
  currentMonth: new Date().getMonth(),
  requestCount: 0
};

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

// AIによるネタバレ分析
async function analyzeWithAI(text) {
  // 月間制限のチェック
  const currentMonth = new Date().getMonth();
  if (currentMonth !== API_RATE_LIMIT.currentMonth) {
    API_RATE_LIMIT.currentMonth = currentMonth;
    API_RATE_LIMIT.requestCount = 0;
  }
  if (API_RATE_LIMIT.requestCount >= API_RATE_LIMIT.maxRequests) {
    console.log('月間APIリクエスト制限に達しました');
    return null;
  }

  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/bert-base-multilingual-uncased', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${huggingFaceToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: text,
        parameters: {
          candidate_labels: ['ネタバレ', '一般']
        }
      })
    });

    if (!response.ok) {
      throw new Error('API request failed');
    }

    API_RATE_LIMIT.requestCount++;
    const result = await response.json();
    
    // スコアを0-1の範囲に正規化
    return result.scores[0];
  } catch (error) {
    console.error('AI分析エラー:', error);
    return null;
  }
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

// フィルタリング強度の計算
async function calculateFilterStrength(element, title) {
  // 基本的なキーワードマッチング
  const hasKeywordMatch = filterKeywords.some(keyword => 
    title.toLowerCase().includes(keyword.toLowerCase())
  );

  let strength = 0;

  // キーワードマッチがある場合のベーススコア
  if (hasKeywordMatch) strength += 0.6;

  // AIフィルタリングが有効で、トークンがある場合
  if (enableAI && huggingFaceToken) {
    const aiScore = await analyzeWithAI(title);
    if (aiScore !== null) {
      // AIスコアと既存のスコアを組み合わせる
      strength = (strength + aiScore) / 2;
    }
  }

  return strength;
}

// 動画要素をフィルタリング
async function filterVideoElement(element) {
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
  const filterStrength = await calculateFilterStrength(element, title);
  
  if (filterStrength > 0.5) {
    if (blurEnabled) {
      // フィルター強度に応じてぼかしを調整
      const adjustedBlurAmount = Math.floor(blurAmount * filterStrength);
      element.style.setProperty('--blur-amount', `${adjustedBlurAmount}px`);
      element.classList.add('spoiler-blur');
      
      // ツールチップで理由とスコアを表示
      const confidence = Math.floor(filterStrength * 100);
      element.title = `ネタバレの可能性: ${confidence}%`;
    } else {
      element.style.display = 'none';
    }
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
  try {
    if (message.type === 'SETTINGS_CHANGED' && message.settings) {
      const settings = message.settings;
      filterEnabled = settings.enabled;
      filterKeywords = settings.keywords || [];
      blurEnabled = settings.enableBlur;
      blurAmount = settings.blurAmount;
      hideShorts = settings.hideShorts;
      enableAI = settings.enableAI;
      huggingFaceToken = settings.huggingFaceToken;

      // 設定変更後にページを再処理
      processPage().catch(error => {
        console.error('ページ処理エラー:', error);
      });

      // 正常に処理完了を通知
      sendResponse({ success: true });
    }
  } catch (error) {
    console.error('設定更新エラー:', error);
    sendResponse({ success: false, error: error.message });
  }
  
  // 非同期レスポンスを有効にする
  return true;
});

// 監視の開始
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// 設定を読み込む
async function loadSettings() {
  const settings = await chrome.storage.sync.get({
    enabled: true,
    enableBlur: true,
    blurAmount: 10,
    keywords: [],
    hideShorts: true,
    enableAI: true,
    huggingFaceToken: ''
  });
  filterEnabled = settings.enabled;
  blurEnabled = settings.enableBlur;
  blurAmount = settings.blurAmount;
  filterKeywords = settings.keywords;
  hideShorts = settings.hideShorts;
  enableAI = settings.enableAI;
  huggingFaceToken = settings.huggingFaceToken;
  processPage();
}

// 初期設定を読み込む
loadSettings();
