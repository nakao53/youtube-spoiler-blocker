document.addEventListener('DOMContentLoaded', async () => {
  const enableFilter = document.getElementById('enableFilter');
  const enableBlur = document.getElementById('enableBlur');
  const blurAmount = document.getElementById('blurAmount');
  const blurValue = document.getElementById('blurValue');
  const keywordInput = document.getElementById('keywordInput');
  const addKeywordBtn = document.getElementById('addKeyword');
  const keywordList = document.getElementById('keywordList');

  // 保存された設定を読み込む
  const loadSettings = async () => {
    const settings = await chrome.storage.sync.get({
      enabled: true,
      enableBlur: true,
      blurAmount: 10,
      keywords: []
    });
    enableFilter.checked = settings.enabled;
    enableBlur.checked = settings.enableBlur;
    blurAmount.value = settings.blurAmount;
    blurValue.textContent = `${settings.blurAmount}px`;
    renderKeywordList(settings.keywords);
  };

  // キーワードリストを表示
  const renderKeywordList = (keywords) => {
    keywordList.innerHTML = keywords.map(keyword => `
      <div class="keyword-item">
        <span>${keyword}</span>
        <span class="remove-btn" data-keyword="${keyword}">×</span>
      </div>
    `).join('');

    // 削除ボタンのイベントリスナーを設定
    document.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const keywordToRemove = btn.dataset.keyword;
        const settings = await chrome.storage.sync.get({ keywords: [] });
        const updatedKeywords = settings.keywords.filter(k => k !== keywordToRemove);
        await chrome.storage.sync.set({ keywords: updatedKeywords });
        renderKeywordList(updatedKeywords);
      });
    });
  };

  // フィルター有効/無効の切り替え
  enableFilter.addEventListener('change', async () => {
    await chrome.storage.sync.set({ enabled: enableFilter.checked });
    notifyContentScript();
  });

  // ぼかし機能の切り替え
  enableBlur.addEventListener('change', async () => {
    await chrome.storage.sync.set({ enableBlur: enableBlur.checked });
    notifyContentScript();
  });

  // ぼかしの強さ変更
  blurAmount.addEventListener('input', () => {
    blurValue.textContent = `${blurAmount.value}px`;
  });

  blurAmount.addEventListener('change', async () => {
    await chrome.storage.sync.set({ blurAmount: Number(blurAmount.value) });
    notifyContentScript();
  });

  // content scriptに設定変更を通知
  const notifyContentScript = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.url.includes('youtube.com')) {
      const settings = await chrome.storage.sync.get({
        enabled: true,
        enableBlur: true,
        blurAmount: 10
      });
      chrome.tabs.sendMessage(tab.id, { 
        type: 'SETTINGS_CHANGED',
        settings
      });
    }
  };

  // キーワード追加
  addKeywordBtn.addEventListener('click', async () => {
    const keyword = keywordInput.value.trim();
    if (keyword) {
      const settings = await chrome.storage.sync.get({ keywords: [] });
      if (!settings.keywords.includes(keyword)) {
        const updatedKeywords = [...settings.keywords, keyword];
        await chrome.storage.sync.set({ keywords: updatedKeywords });
        renderKeywordList(updatedKeywords);
        keywordInput.value = '';
        notifyContentScript();
      }
    }
  });

  // Enter キーでもキーワード追加
  keywordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addKeywordBtn.click();
    }
  });

  // 初期設定を読み込む
  loadSettings();
});
