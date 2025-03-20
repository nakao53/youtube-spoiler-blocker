document.addEventListener('DOMContentLoaded', async () => {
  const enableFilter = document.getElementById('enableFilter');
  const hideShorts = document.getElementById('hideShorts');
  const enableBlur = document.getElementById('enableBlur');
  const enableAI = document.getElementById('enableAI');
  const huggingFaceToken = document.getElementById('huggingFaceToken');
  const blurAmount = document.getElementById('blurAmount');
  const blurValue = document.getElementById('blurValue');
  const keywordInput = document.getElementById('keywordInput');
  const addKeywordBtn = document.getElementById('addKeyword');
  const keywordList = document.getElementById('keywordList');

  // 保存された設定を読み込む
  const loadSettings = async () => {
    const settings = await chrome.storage.sync.get({
      enabled: true,
      hideShorts: true,
      enableBlur: true,
      enableAI: true,
      huggingFaceToken: '',
      blurAmount: 10,
      keywords: []
    });
    enableFilter.checked = settings.enabled;
    hideShorts.checked = settings.hideShorts;
    enableBlur.checked = settings.enableBlur;
    enableAI.checked = settings.enableAI;
    huggingFaceToken.value = settings.huggingFaceToken;
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

  // ショート動画非表示の切り替え
  hideShorts.addEventListener('change', async () => {
    await chrome.storage.sync.set({ hideShorts: hideShorts.checked });
    notifyContentScript();
  });

  // ぼかし機能の切り替え
  enableBlur.addEventListener('change', async () => {
    await chrome.storage.sync.set({ enableBlur: enableBlur.checked });
    notifyContentScript();
  });

  // AIフィルタリングの設定変更
  enableAI.addEventListener('change', async () => {
    await chrome.storage.sync.set({ enableAI: enableAI.checked });
    notifyContentScript();
  });

  // Hugging Face APIトークンの保存
  huggingFaceToken.addEventListener('change', async () => {
    await chrome.storage.sync.set({ huggingFaceToken: huggingFaceToken.value });
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
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      // YouTubeのタブが存在し、かつURLがYouTubeである場合のみ通知
      if (currentTab && currentTab.url && currentTab.url.includes('youtube.com')) {
        const settings = await chrome.storage.sync.get({
          enabled: enableFilter.checked,
          hideShorts: hideShorts.checked,
          enableBlur: enableBlur.checked,
          enableAI: enableAI.checked,
          huggingFaceToken: huggingFaceToken.value,
          blurAmount: Number(blurAmount.value),
          keywords: await getKeywords()
        });

        try {
          await chrome.tabs.sendMessage(currentTab.id, {
            type: 'SETTINGS_CHANGED',
            settings
          });
        } catch (error) {
          console.log('Content scriptとの通信エラー:', error);
          // エラーを無視して続行（タブがリロードされた直後などは正常）
        }
      }
    } catch (error) {
      console.log('タブの取得エラー:', error);
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

  // キーワードリストを取得
  const getKeywords = async () => {
    const settings = await chrome.storage.sync.get({ keywords: [] });
    return settings.keywords;
  };

  // 初期設定を読み込む
  loadSettings();
});
