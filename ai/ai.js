const menu = document.querySelector('.menu');
const nav = document.querySelector('#nav');

if (menu && nav) {
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') === 'true';
    menu.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('open', !open);
  });

  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      menu.setAttribute('aria-expanded', 'false');
      nav.classList.remove('open');
    }
  });
}

async function addSocialPerformanceEvidence() {
  const editorShell = document.querySelector('#editor .shell');
  if (!editorShell) return;

  try {
    const response = await fetch('SOCIAL_METRICS.yaml', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Social metrics unavailable: ${response.status}`);
    const evidence = await response.json();
    if (!evidence.verification?.verified_metrics_only) return;

    const weekly = evidence.weekly;
    const topViews = weekly.top_content
      .filter((item) => item.views !== null && item.views !== undefined)
      .map((item) => item.views)
      .join('、');

    const block = document.createElement('section');
    block.className = 'performance-evidence';
    block.setAttribute('aria-labelledby', 'performance-title');
    block.innerHTML = `
      <header class="performance-head">
        <p class="case-kicker">真實營運證據 · Instagram Weekly Review</p>
        <h3 id="performance-title">這套內容流程，已經實際用在 KennyG Cake</h3>
        <p>不是模擬數據，也不是設計稿。以下是同一週經核驗的發布與瀏覽結果。</p>
      </header>
      <div class="performance-metrics">
        <article><strong>${weekly.posts}</strong><span>Posts</span></article>
        <article><strong>${weekly.reels}</strong><span>Reels</span></article>
        <article><strong>${weekly.views}</strong><span>Weekly Views</span></article>
        <article><strong>${weekly.non_followers}%</strong><span>Non-followers</span></article>
        <article><strong>+${weekly.growth.views_percent}%</strong><span>較前一週</span></article>
      </div>
      <div class="performance-shots">
        <figure class="real-shot"><img src="assets/performance/instagram-weekly-summary.jpg" alt="Instagram 每週發布、瀏覽與非粉絲占比摘要"><figcaption><b>一週發布 3 篇貼文、2 支 Reels</b><span>483 次瀏覽，其中 92% 來自非粉絲；最多瀏覽內容為 ${topViews}。</span></figcaption></figure>
        <figure class="real-shot"><img src="assets/performance/instagram-weekly-growth.jpg" alt="Instagram 瀏覽次數較前一週增加 49%"><figcaption><b>本週瀏覽次數較前一週增加 49%</b><span>這是單週營運紀錄，不代表長期成長或未來成效保證。</span></figcaption></figure>
      </div>`;
    editorShell.append(block);
  } catch (error) {
    console.error(error);
  }
}

addSocialPerformanceEvidence();
