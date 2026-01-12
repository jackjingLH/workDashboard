/**
 * 菜品查询与工作数据聚合 - Content Script
 * 在 OA 页面注入侧边栏和菜品详情功能
 */

// ===== 状态管理 =====
let isSidebarOpen = false;

// ===== 初始化 =====
(function init() {
  console.log('[Content Script] 效率工具箱已加载');

  // 创建侧边栏和触发按钮
  createSidebar();
})();

// ===== 创建侧边栏 =====
function createSidebar() {
  // 侧边栏容器
  const sidebar = document.createElement('div');
  sidebar.id = 'work-enhance-sidebar';
  sidebar.innerHTML = `
    <!-- 侧边栏触发按钮 -->
    <div class="sidebar-trigger" id="sidebarTrigger" title="效率工具箱">
      <div class="trigger-icon">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>

    <!-- 侧边栏主体 -->
    <div class="sidebar-panel" id="sidebarPanel">
      <div class="sidebar-header">
        <h2>效率工具箱</h2>
        <button class="sidebar-close" id="sidebarClose">✕</button>
      </div>

      <div class="sidebar-body">
        <!-- GitLab 工作统计 -->
        <div class="feature-module" id="gitlabModule">
          <div class="module-header">
            <span class="module-icon">🦊</span>
            <span class="module-title">GitLab 工作统计</span>
            <select class="date-range-select" id="gitlabDateRange">
              <option value="today">今天</option>
              <option value="week">本周</option>
              <option value="month">本月</option>
            </select>
          </div>
          <div class="module-content" id="gitlabContent">
            <div class="loading-placeholder" id="gitlabLoading">
              <div class="spinner-mini"></div>
              <span>加载中...</span>
            </div>
            <div class="gitlab-data" id="gitlabData" style="display: none;">
              <div class="stat-item">
                <span class="stat-label" id="gitlabCommitsLabel">今日提交:</span>
                <span class="stat-value" id="gitlabCommits">-</span>
              </div>
              <div class="stat-item" id="gitlabMrItem" style="display: none;">
                <span class="stat-label">合并 MR:</span>
                <span class="stat-value" id="gitlabMR">-</span>
              </div>
              <div class="stat-item" id="gitlabProjectsItem" style="display: none;">
                <span class="stat-label">项目:</span>
                <span class="stat-value stat-value-small" id="gitlabProjects">-</span>
              </div>
              <button class="action-btn" id="generateSummaryBtn" style="margin-top: 12px; width: 100%;">
                <span id="generateSummaryBtnText">🤖 分析今日工作内容</span>
              </button>
              <div class="summary-loading" id="summaryLoading" style="display: none;">
                <div class="spinner-mini"></div>
                <span>AI 正在分析...</span>
              </div>
              <div class="summary-result" id="summaryResult" style="display: none;">
                <h4 id="summaryTitle">📝 今日工作内容</h4>
                <div class="summary-content" id="summaryContent"></div>
              </div>
              <div class="summary-error" id="summaryError" style="display: none;"></div>
            </div>
            <div class="login-reminder" id="gitlabLoginReminder" style="display: none;">
              <span>⚠️ 尚未登录</span>
              <a href="#" id="gitlabLoginLink" target="_blank" class="login-link-btn">前往登录</a>
            </div>
          </div>
        </div>

        <!-- 禅道统计 -->
        <div class="feature-module" id="zentaoModule">
          <div class="module-header">
            <span class="module-icon">🐛</span>
            <span class="module-title">禅道统计</span>
          </div>
          <div class="module-content" id="zentaoContent">
            <div class="loading-placeholder" id="zentaoLoading">
              <div class="spinner-mini"></div>
              <span>加载中...</span>
            </div>
            <div class="zentao-data" id="zentaoData" style="display: none;">
              <!-- 任务统计 -->
              <div class="zentao-category">
                <div class="zentao-summary">
                  <div class="stat-item">
                    <span class="stat-label">📋 本月任务:</span>
                    <span class="stat-value" id="zentaoTasksCount">-</span>
                  </div>
                  <button class="toggle-btn-mini" id="toggleTasksBtnSidebar" style="display: none;">展开 ▼</button>
                </div>
                <div class="stat-item" id="zentaoTasksEstimateItem" style="display: none;">
                  <span class="stat-label">⏱️ 预计工时:</span>
                  <span class="stat-value" id="zentaoTasksEstimate">-</span>
                </div>
                <div class="zentao-detail-list" id="zentaoTasksListSidebar" style="display: none;">
                  <!-- 任务列表将通过 JS 动态生成 -->
                </div>
              </div>

              <!-- Bug 统计 -->
              <div class="zentao-category">
                <div class="zentao-summary">
                  <div class="stat-item">
                    <span class="stat-label">🐞 本月 Bug:</span>
                    <span class="stat-value" id="zentaoBugsCount">-</span>
                  </div>
                  <button class="toggle-btn-mini" id="toggleBugsBtnSidebar" style="display: none;">展开 ▼</button>
                </div>
                <div class="zentao-detail-list" id="zentaoBugsListSidebar" style="display: none;">
                  <!-- Bug 列表将通过 JS 动态生成 -->
                </div>
              </div>

              <!-- AI Bug 分析 -->
              <button class="action-btn" id="generateBugSummaryBtn" style="margin-top: 12px; width: 100%;">
                🤖 AI 分析本月 Bug
              </button>
              <div class="summary-loading" id="bugSummaryLoading" style="display: none;">
                <div class="spinner-mini"></div>
                <span>AI 正在分析...</span>
              </div>
              <div class="summary-result" id="bugSummaryResult" style="display: none;">
                <h4>📊 Bug 分析报告</h4>
                <div class="summary-content" id="bugSummaryContent"></div>
              </div>
              <div class="summary-error" id="bugSummaryError" style="display: none;"></div>
            </div>
            <div class="login-reminder" id="zentaoLoginReminder" style="display: none;">
              <span>⚠️ 尚未登录</span>
              <a href="#" id="zentaoLoginLink" target="_blank" class="login-link-btn">前往登录</a>
            </div>
          </div>
        </div>

        <!-- 菜品查询 -->
        <div class="feature-module">
          <div class="module-header">
            <span class="module-icon">🍽️</span>
            <span class="module-title">菜品查询</span>
          </div>
          <div class="module-content">
            <div class="module-desc">为菜品添加详情图标，查看 AI 分析的食材、做法等信息</div>
            <div class="module-control">
              <button class="action-btn" id="injectDishIconBtn">注入菜品图标</button>
              <span class="status-text" id="dishIconStatus" style="display: none;"></span>
            </div>
          </div>
        </div>

        <!-- 预留其他功能模块 -->
        <div class="feature-module disabled">
          <div class="module-header">
            <span class="module-icon">📊</span>
            <span class="module-title">待办事项统计</span>
          </div>
          <div class="module-content">
            <div class="module-desc">敬请期待...</div>
          </div>
        </div>

        <div class="feature-module disabled">
          <div class="module-header">
            <span class="module-icon">🔔</span>
            <span class="module-title">智能提醒</span>
          </div>
          <div class="module-content">
            <div class="module-desc">敬请期待...</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // 插入到 html 元素下，与 body 同级
  document.documentElement.appendChild(sidebar);

  // 绑定事件
  bindSidebarEvents();

  // 加载 GitLab 数据
  loadGitLabData();

  // 加载禅道数据
  loadZentaoData();
}

// ===== 绑定侧边栏事件 =====
function bindSidebarEvents() {
  const trigger = document.getElementById('sidebarTrigger');
  const closeBtn = document.getElementById('sidebarClose');
  const injectBtn = document.getElementById('injectDishIconBtn');
  const statusText = document.getElementById('dishIconStatus');

  // 触发按钮 toggle 侧边栏
  trigger.addEventListener('click', () => {
    if (isSidebarOpen) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  // 关闭按钮
  closeBtn.addEventListener('click', () => {
    closeSidebar();
  });

  // 食堂菜单增强按钮
  injectBtn.addEventListener('click', async () => {
    console.log('[Content Script] 用户点击注入菜品图标');

    // 禁用按钮防止重复点击
    injectBtn.disabled = true;
    injectBtn.textContent = '正在注入...';

    try {
      await waitForIframeAndInject();

      // 显示成功提示
      statusText.style.display = 'inline';
      statusText.textContent = '✓ 注入成功';
      statusText.style.color = '#10b981';

      injectBtn.textContent = '重新注入';

      // 3秒后隐藏提示
      setTimeout(() => {
        statusText.style.display = 'none';
      }, 3000);
    } catch (error) {
      console.error('[Content Script] 注入失败:', error);

      // 显示失败提示
      statusText.style.display = 'inline';
      statusText.textContent = '✗ 注入失败';
      statusText.style.color = '#ef4444';

      injectBtn.textContent = '重试注入';

      setTimeout(() => {
        statusText.style.display = 'none';
      }, 3000);
    } finally {
      injectBtn.disabled = false;
    }
  });

  // GitLab 日期范围切换
  const gitlabDateRange = document.getElementById('gitlabDateRange');
  if (gitlabDateRange) {
    gitlabDateRange.addEventListener('change', async () => {
      console.log('[Content Script] GitLab 日期范围切换:', gitlabDateRange.value);
      await onGitLabDateRangeChange(gitlabDateRange.value);
    });
  }

  // AI 工作内容分析
  const generateSummaryBtn = document.getElementById('generateSummaryBtn');
  if (generateSummaryBtn) {
    generateSummaryBtn.addEventListener('click', async () => {
      console.log('[Content Script] 用户点击分析工作内容');
      await generateSummary();
    });
  }

  // Bug AI 总结生成
  const generateBugSummaryBtn = document.getElementById('generateBugSummaryBtn');
  if (generateBugSummaryBtn) {
    generateBugSummaryBtn.addEventListener('click', async () => {
      console.log('[Content Script] 用户点击生成 Bug 总结');
      await generateBugSummary();
    });
  }

  // 禅道任务展开/收起
  const toggleTasksBtnSidebar = document.getElementById('toggleTasksBtnSidebar');
  if (toggleTasksBtnSidebar) {
    toggleTasksBtnSidebar.addEventListener('click', () => {
      toggleZentaoListSidebar('tasks');
    });
  }

  // 禅道Bug展开/收起
  const toggleBugsBtnSidebar = document.getElementById('toggleBugsBtnSidebar');
  if (toggleBugsBtnSidebar) {
    toggleBugsBtnSidebar.addEventListener('click', () => {
      toggleZentaoListSidebar('bugs');
    });
  }
}

// 打开侧边栏
function openSidebar() {
  isSidebarOpen = true;
  document.getElementById('work-enhance-sidebar').classList.add('active');
  console.log('[Content Script] 侧边栏已打开');
}

// 关闭侧边栏
function closeSidebar() {
  isSidebarOpen = false;
  document.getElementById('work-enhance-sidebar').classList.remove('active');
  console.log('[Content Script] 侧边栏已关闭');
}

// ===== 等待 iframe 加载并注入 =====
async function waitForIframeAndInject() {
  const iframe = document.querySelector('#mainFrame');

  if (!iframe) {
    console.log('[Content Script] 未找到 iframe，直接注入');
    injectDishIcons();
    return;
  }

  // 等待 iframe 加载完成
  if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
    console.log('[Content Script] iframe 已加载完成');
    injectDishIcons();
  } else {
    console.log('[Content Script] 等待 iframe 加载...');
    iframe.addEventListener('load', () => {
      console.log('[Content Script] iframe 加载完成，开始注入');
      injectDishIcons();
    }, { once: true });
  }
}

// ===== DOM 扫描与图标注入 =====
function injectDishIcons() {
  // 优先尝试访问 iframe 内部（食堂菜单在 iframe 中）
  const iframe = document.querySelector('#mainFrame');
  let targetDoc = document;

  if (iframe && iframe.contentDocument) {
    targetDoc = iframe.contentDocument;
    console.log('[Content Script] 检测到 iframe，将在 iframe 内部注入');
  } else {
    console.log('[Content Script] 未检测到 iframe，在当前页面注入');
  }

  // 查找所有菜品标签
  const labels = targetDoc.querySelectorAll('label.form-check-label');
  console.log(`[Content Script] 找到 ${labels.length} 个 label.form-check-label 元素`);

  let injectedCount = 0;

  labels.forEach((label, index) => {
    // 跳过已注入的
    if (label.querySelector('.dish-detail-icon')) return;

    const labelText = label.textContent.trim();

    // 调试：输出前 5 个标签的内容
    if (index < 5) {
      console.log(`[Content Script] Label ${index + 1} 内容: "${labelText}"`);
    }

    const dishName = extractDishName(labelText);

    if (index < 5) {
      console.log(`[Content Script] Label ${index + 1} 提取菜名: ${dishName ? `"${dishName}"` : '未匹配'}`);
    }

    if (!dishName) return;

    // 创建图标
    const icon = document.createElement('span');
    icon.className = 'dish-detail-icon';
    icon.textContent = '🔍';
    icon.title = `查看"${dishName}"的详细信息`;
    icon.dataset.dish = dishName;

    // 绑定点击事件
    icon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showDishModal(dishName);
    });

    label.appendChild(icon);
    injectedCount++;
  });

  console.log(`[Content Script] 已注入 ${injectedCount} 个菜品图标`);
}

// 提取菜品名称（从第二个括号中提取）
function extractDishName(text) {
  console.log(`[Content Script] 原始文本: "${text}"`);

  // 提取所有括号内容（包括半角和全角），按照出现顺序
  // 格式: "晚餐C-特色餐（20元）(土豆焖牛腩)(2/60)" 或 "晚餐C-特色餐（20元）(土豆焖牛腩)"
  const allBrackets = [];

  // 使用统一的正则匹配所有括号（半角和全角）
  const bracketRegex = /[(（]([^)）]+)[)）]/g;
  let match;
  while ((match = bracketRegex.exec(text)) !== null) {
    allBrackets.push(match[1].trim());
  }

  console.log(`[Content Script] 提取到 ${allBrackets.length} 个括号:`, allBrackets);

  // 如果有至少2个括号，返回第二个（菜品名称）
  if (allBrackets.length >= 2) {
    const dishName = allBrackets[1];
    console.log(`[Content Script] 提取菜名（第2个括号）: "${dishName}"`);
    return dishName;
  }

  // 如果只有1个括号，可能是简化格式，返回第一个
  if (allBrackets.length === 1) {
    const dishName = allBrackets[0];
    console.log(`[Content Script] 提取菜名（第1个括号）: "${dishName}"`);
    return dishName;
  }

  console.log('[Content Script] 未找到括号，无法提取菜名');
  return null;
}

// 移除所有图标
function removeAllIcons() {
  // 尝试从 iframe 内部移除
  const iframe = document.querySelector('#mainFrame');
  let targetDoc = document;

  if (iframe && iframe.contentDocument) {
    targetDoc = iframe.contentDocument;
  }

  const icons = targetDoc.querySelectorAll('.dish-detail-icon');
  icons.forEach(icon => icon.remove());
  console.log(`[Content Script] 已移除 ${icons.length} 个菜品图标`);
}

// ===== Modal 弹窗（居中显示） =====
async function showDishModal(dishName) {
  console.log(`[Content Script] 请求菜品详情: ${dishName}`);

  // 创建 Modal
  createDishModal();

  // 显示加载状态
  showModalLoading();

  try {
    // 1. 先检查配置
    console.log('[Content Script] 检查 API 配置...');
    const configCheck = await chrome.runtime.sendMessage({
      action: 'checkApiConfig'
    });

    // 2. 如果缺少必需配置（AI API），显示配置引导
    if (!configCheck.success) {
      showModalError(configCheck.message || '配置检查失败');
      return;
    }

    // 3. 如果有警告（SerpAPI 未配置），在 console 提示但继续
    if (configCheck.warning) {
      console.warn('[Content Script]', configCheck.message);
    }

    // 4. 判断餐别（根据当前时间）
    const mealType = getCurrentMealType();

    // 5. 向 Background 请求数据
    console.log('[Content Script] 开始获取菜品详情...');
    const response = await chrome.runtime.sendMessage({
      action: 'getDishDetail',
      dishName: dishName,
      mealType: mealType
    });

    if (response.success) {
      renderModalContent(response.data);
    } else {
      showModalError(response.error || '获取菜品信息失败，请稍后重试');
    }
  } catch (error) {
    console.error('[Content Script] 获取菜品详情失败:', error);
    showModalError('网络请求失败，请稍后重试');
  }
}

// 创建 Modal 结构（居中弹窗）
function createDishModal() {
  console.log('[DEBUG] 开始创建弹窗');

  // 如果已存在，先移除
  const existing = document.getElementById('dish-detail-modal');
  if (existing) {
    console.log('[DEBUG] 移除已存在的弹窗');
    existing.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'dish-detail-modal';
  modal.innerHTML = `
    <div class="modal-overlay" id="dishModalOverlay"></div>
    <div class="modal-dialog" id="dishModalDialog">
      <div class="modal-header">
        <h2>菜品详情</h2>
        <button class="close-btn" id="closeModalBtn">✕</button>
      </div>
      <div class="modal-body" id="dishModalBody">
        <!-- 内容将动态填充 -->
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  console.log('[DEBUG] 弹窗已添加到 body');

  // 绑定关闭事件 - 只点击遮罩层关闭
  const overlay = document.getElementById('dishModalOverlay');
  overlay.addEventListener('click', (e) => {
    console.log('[DEBUG] Overlay 点击事件触发');
    console.log('[DEBUG] e.target.id:', e.target.id);
    console.log('[DEBUG] e.currentTarget.id:', e.currentTarget.id);
    console.log('[DEBUG] e.target === overlay:', e.target === overlay);

    // 确保点击的是遮罩层本身，而不是其他元素
    if (e.target === overlay) {
      console.log('[DEBUG] 点击的是遮罩层，关闭弹窗');
      closeDishModal();
    } else {
      console.log('[DEBUG] 点击的不是遮罩层，不关闭');
    }
  });

  // 关闭按钮
  document.getElementById('closeModalBtn').addEventListener('click', (e) => {
    console.log('[DEBUG] 关闭按钮点击');
    e.stopPropagation();
    closeDishModal();
  });

  // 阻止 modal-dialog 的所有点击事件冒泡到 overlay
  const modalDialog = document.getElementById('dishModalDialog');
  const modalBody = document.getElementById('dishModalBody');

  modalDialog.addEventListener('click', (e) => {
    console.log('[DEBUG] modalDialog 点击事件，阻止冒泡');
    console.log('[DEBUG] 点击目标:', e.target.className);
    // 阻止所有点击事件冒泡
    e.stopPropagation();
  });

  // 允许弹窗内部滚动 - 鼠标滚轮
  modalBody.addEventListener('wheel', (e) => {
    console.log('[DEBUG] 滚轮事件触发，scrollTop:', modalBody.scrollTop);
    console.log('[DEBUG] scrollHeight:', modalBody.scrollHeight);
    console.log('[DEBUG] clientHeight:', modalBody.clientHeight);
    // 不阻止默认行为，让滚动正常工作
    e.stopPropagation();
  }, { passive: true });

  // 允许触摸滚动（移动端）
  modalBody.addEventListener('touchmove', (e) => {
    console.log('[DEBUG] 触摸滚动事件触发');
    e.stopPropagation();
  }, { passive: true });

  // 添加滚动事件监听以便调试
  modalBody.addEventListener('scroll', (e) => {
    console.log('[DEBUG] 滚动事件触发，当前 scrollTop:', modalBody.scrollTop);
  });

  // ESC 键关闭
  document.addEventListener('keydown', handleEscKey);

  // 添加显示动画
  setTimeout(() => {
    modal.classList.add('active');
    console.log('[DEBUG] 弹窗已激活');
  }, 10);
}

// 显示加载状态
function showModalLoading() {
  const modalBody = document.getElementById('dishModalBody');
  modalBody.innerHTML = `
    <div class="loading-skeleton">
      <div class="skeleton-image"></div>
      <div class="skeleton-title"></div>
      <div class="skeleton-text"></div>
      <div class="skeleton-text"></div>
      <div class="skeleton-tags">
        <div class="skeleton-tag"></div>
        <div class="skeleton-tag"></div>
        <div class="skeleton-tag"></div>
      </div>
    </div>
  `;
}

// 渲染菜品详情
function renderModalContent(dishData) {
  const modalBody = document.getElementById('dishModalBody');

  // 生成食材标签 HTML
  const ingredientsHtml = (dishData.ingredients || [])
    .map(ing => `<span class="tag tag-ingredient">${ing}</span>`)
    .join('');

  // 生成做法标签 HTML
  const methodsHtml = (dishData.cookingMethods || [])
    .map(method => `<span class="tag tag-method">${method}</span>`)
    .join('');

  // 生成做法步骤 HTML
  const stepsHtml = (dishData.cookingSteps || [])
    .map((step, index) => `
      <div class="cooking-step">
        <span class="step-number">${index + 1}</span>
        <span class="step-text">${step}</span>
      </div>
    `).join('');

  // 生成轮播图 HTML
  let carouselHtml = '';
  if (dishData.imageUrls && dishData.imageUrls.length > 0) {
    const carouselItemsHtml = dishData.imageUrls.map((url, index) => `
      <div class="dish-carousel-item">
        <img src="${url}" alt="${dishData.dishName} ${index + 1}" onerror="this.parentElement.style.display='none'">
      </div>
    `).join('');

    const indicatorsHtml = dishData.imageUrls.map((_, index) => `
      <span class="dish-carousel-indicator ${index === 0 ? 'active' : ''}" data-index="${index}"></span>
    `).join('');

    carouselHtml = `
      <div class="dish-carousel" id="dishCarousel">
        <div class="dish-carousel-inner" id="dishCarouselInner">
          ${carouselItemsHtml}
        </div>
        ${dishData.imageUrls.length > 1 ? `
          <button class="dish-carousel-control prev" id="carouselPrev">‹</button>
          <button class="dish-carousel-control next" id="carouselNext">›</button>
          <div class="dish-carousel-indicators" id="carouselIndicators">
            ${indicatorsHtml}
          </div>
        ` : ''}
      </div>
    `;
  } else {
    carouselHtml = `
      <div class="dish-image-placeholder">
        <span class="placeholder-icon">🍽️</span>
        <p>暂无图片</p>
      </div>
    `;
  }

  modalBody.innerHTML = `
    <div class="dish-detail">
      ${carouselHtml}

      <div class="dish-info">
        <h3 class="dish-name">${dishData.dishName}</h3>
        <p class="dish-intro">${dishData.intro}</p>

        ${dishData.ingredients && dishData.ingredients.length > 0 ? `
          <div class="dish-section">
            <h4>主要食材</h4>
            <div class="tags">${ingredientsHtml}</div>
          </div>
        ` : ''}

        ${dishData.cookingMethods && dishData.cookingMethods.length > 0 ? `
          <div class="dish-section">
            <h4>做法关键词</h4>
            <div class="tags">${methodsHtml}</div>
          </div>
        ` : ''}

        ${dishData.cookingSteps && dishData.cookingSteps.length > 0 ? `
          <div class="dish-section">
            <h4>做法步骤</h4>
            <div class="cooking-steps">${stepsHtml}</div>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  // 初始化轮播图
  if (dishData.imageUrls && dishData.imageUrls.length > 1) {
    initCarousel();
  }
}

// 显示错误信息
function showModalError(message) {
  const modalBody = document.getElementById('dishModalBody');

  // 检测是否为配置错误（包含 ⚙️ 符号或关键词）
  const isConfigError = message.includes('⚙️') || message.includes('需要配置') || message.includes('未配置');

  if (isConfigError) {
    // 配置错误：显示配置引导
    modalBody.innerHTML = `
      <div class="error-message">
        <span class="error-icon">⚙️</span>
        <p style="white-space: pre-line;">${message}</p>
        <div style="display: flex; gap: 12px; margin-top: 16px;">
          <button class="retry-btn" onclick="chrome.runtime.openOptionsPage ? chrome.runtime.openOptionsPage() : window.open(chrome.runtime.getURL('popup.html'))">前往配置</button>
          <button class="retry-btn" style="background: #e5e7eb; color: #6b7280;" onclick="document.getElementById('closeModalBtn').click()">关闭</button>
        </div>
      </div>
    `;
  } else {
    // 普通错误：只显示关闭按钮
    modalBody.innerHTML = `
      <div class="error-message">
        <span class="error-icon">⚠️</span>
        <p>${message}</p>
        <button class="retry-btn" onclick="document.getElementById('closeModalBtn').click()">关闭</button>
      </div>
    `;
  }
}

// 关闭 Modal
function closeDishModal() {
  console.log('[DEBUG] 关闭弹窗');
  const modal = document.getElementById('dish-detail-modal');
  if (!modal) {
    console.log('[DEBUG] 弹窗不存在');
    return;
  }

  modal.classList.remove('active');
  setTimeout(() => {
    modal.remove();
    console.log('[DEBUG] 弹窗已移除');
  }, 300);

  document.removeEventListener('keydown', handleEscKey);
}

// ESC 键处理
function handleEscKey(e) {
  if (e.key === 'Escape') {
    closeDishModal();
  }
}

// 获取当前餐别
function getCurrentMealType() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 10) return 'breakfast';
  if (hour >= 10 && hour < 14) return 'lunch';
  if (hour >= 14 && hour < 20) return 'dinner';
  return 'lunch'; // 默认午餐
}

// ===== GitLab 功能 =====

/**
 * 加载 GitLab 数据
 */
async function loadGitLabData() {
  console.log('[Content Script] 开始加载 GitLab 数据');

  try {
    // 发送消息给 background 获取数据
    const response = await chrome.runtime.sendMessage({
      action: 'refreshData'
    });

    console.log('[Content Script] 收到 background 响应:', response);

    if (response && response.success) {
      renderGitLabData(response.data, response.gitlabLoginError);
    } else {
      console.error('[Content Script] 数据加载失败:', response?.error);
      // 即使失败也要渲染，可能是配置未启用
      renderGitLabData(null, null);
    }
  } catch (error) {
    console.error('[Content Script] 加载 GitLab 数据失败:', error);
    renderGitLabData(null, null);
  }
}

/**
 * 渲染 GitLab 数据
 */
function renderGitLabData(data, loginError) {
  const gitlabModule = document.getElementById('gitlabModule');
  const gitlabLoading = document.getElementById('gitlabLoading');
  const gitlabData = document.getElementById('gitlabData');
  const gitlabLoginReminder = document.getElementById('gitlabLoginReminder');
  const gitlabLoginLink = document.getElementById('gitlabLoginLink');

  if (!gitlabModule) return;

  // 隐藏加载状态
  if (gitlabLoading) {
    gitlabLoading.style.display = 'none';
  }

  // 检查是否启用了 GitLab
  chrome.storage.local.get(['systems'], (result) => {
    const config = result.systems || {};
    const gitlabConfig = config.gitlab || {};

    if (!gitlabConfig.enabled) {
      // 未启用，隐藏模块
      gitlabModule.style.display = 'none';
      return;
    }

    // 已启用，显示模块
    gitlabModule.style.display = 'block';

    // 检查登录状态
    if (loginError) {
      gitlabData.style.display = 'none';
      gitlabLoginReminder.style.display = 'flex';
      gitlabLoginLink.href = loginError.loginUrl || gitlabConfig.baseURL;
      return;
    }

    if (!data || !data.gitlab) {
      return;
    }

    // 显示数据，隐藏登录提示
    gitlabLoginReminder.style.display = 'none';
    gitlabData.style.display = 'block';

    // 获取当前日期范围
    const dateRange = gitlabConfig.dateRange || 'today';

    // 更新提交标签文本
    const labelMap = {
      today: '今日提交:',
      week: '本周提交:',
      month: '本月提交:'
    };
    const gitlabCommitsLabel = document.getElementById('gitlabCommitsLabel');
    if (gitlabCommitsLabel) {
      gitlabCommitsLabel.textContent = labelMap[dateRange] || '今日提交:';
    }

    // 渲染提交次数
    const gitlabCommits = document.getElementById('gitlabCommits');
    if (gitlabCommits) {
      gitlabCommits.textContent = data.gitlab.commits || 0;
    }

    // 渲染 MR 统计
    const gitlabMrItem = document.getElementById('gitlabMrItem');
    const gitlabMR = document.getElementById('gitlabMR');
    if (data.gitlab.mergeRequests && data.gitlab.mergeRequests.merged > 0) {
      gitlabMrItem.style.display = 'flex';
      gitlabMR.textContent = data.gitlab.mergeRequests.merged;
    } else {
      gitlabMrItem.style.display = 'none';
    }

    // 渲染项目分布
    const gitlabProjectsItem = document.getElementById('gitlabProjectsItem');
    const gitlabProjects = document.getElementById('gitlabProjects');
    if (data.gitlab.projects && Object.keys(data.gitlab.projects).length > 0) {
      gitlabProjectsItem.style.display = 'flex';
      const allProjects = Object.entries(data.gitlab.projects)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `${name}(${count})`)
        .join(', ');
      gitlabProjects.textContent = allProjects;
    } else {
      gitlabProjectsItem.style.display = 'none';
    }

    // 更新工作内容分析按钮文本
    const summaryBtnTextMap = {
      today: '🤖 分析今日工作内容',
      week: '🤖 分析本周工作内容',
      month: '🤖 分析本月工作内容'
    };
    const generateSummaryBtnText = document.getElementById('generateSummaryBtnText');
    if (generateSummaryBtnText) {
      generateSummaryBtnText.textContent = summaryBtnTextMap[dateRange] || '🤖 分析工作内容';
    }

    // 更新分析结果标题
    const titleMap = {
      today: '📝 今日工作内容',
      week: '📝 本周工作内容',
      month: '📝 本月工作内容'
    };
    const summaryTitle = document.getElementById('summaryTitle');
    if (summaryTitle) {
      summaryTitle.textContent = titleMap[dateRange] || '📝 工作内容';
    }
  });
}

/**
 * GitLab 日期范围切换
 */
async function onGitLabDateRangeChange(dateRange) {
  console.log('[Content Script] 切换日期范围:', dateRange);

  try {
    // 保存日期范围到配置
    const result = await chrome.storage.local.get(['systems']);
    const systems = result.systems || {};
    if (!systems.gitlab) {
      systems.gitlab = {};
    }
    systems.gitlab.dateRange = dateRange;
    await chrome.storage.local.set({ systems });

    // 显示加载状态
    const gitlabLoading = document.getElementById('gitlabLoading');
    const gitlabData = document.getElementById('gitlabData');
    if (gitlabLoading) gitlabLoading.style.display = 'flex';
    if (gitlabData) gitlabData.style.display = 'none';

    // 清空之前的总结
    const summaryResult = document.getElementById('summaryResult');
    const summaryError = document.getElementById('summaryError');
    if (summaryResult) summaryResult.style.display = 'none';
    if (summaryError) summaryError.style.display = 'none';

    // 重新加载数据
    await loadGitLabData();
  } catch (error) {
    console.error('[Content Script] 切换日期范围失败:', error);
  }
}

/**
 * 分析工作内容（AI）
 */
async function generateSummary() {
  console.log('[Content Script] 开始分析工作内容');

  const summaryLoading = document.getElementById('summaryLoading');
  const summaryResult = document.getElementById('summaryResult');
  const summaryError = document.getElementById('summaryError');
  const summaryContent = document.getElementById('summaryContent');
  const generateSummaryBtn = document.getElementById('generateSummaryBtn');

  // 隐藏之前的结果
  if (summaryResult) summaryResult.style.display = 'none';
  if (summaryError) summaryError.style.display = 'none';

  // 显示加载状态
  if (summaryLoading) summaryLoading.style.display = 'flex';
  if (generateSummaryBtn) generateSummaryBtn.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'generateSummary'
    });

    if (response.success) {
      // 显示总结结果
      if (summaryContent) summaryContent.textContent = response.summary;
      if (summaryResult) summaryResult.style.display = 'block';
      console.log('[Content Script] 工作内容分析成功');
    } else {
      // 显示错误
      if (summaryError) {
        summaryError.textContent = response.error || '生成失败';
        summaryError.style.display = 'block';
      }
    }
  } catch (error) {
    console.error('[Content Script] 分析工作内容失败:', error);
    if (summaryError) {
      summaryError.textContent = '生成失败: ' + error.message;
      summaryError.style.display = 'block';
    }
  } finally {
    // 隐藏加载状态
    if (summaryLoading) summaryLoading.style.display = 'none';
    if (generateSummaryBtn) generateSummaryBtn.disabled = false;
  }
}

/**
 * 加载禅道数据
 */
async function loadZentaoData() {
  console.log('[Content Script] 开始加载禅道数据');

  try {
    // 发送消息给 background 获取数据
    const response = await chrome.runtime.sendMessage({
      action: 'refreshData'
    });

    console.log('[Content Script] 收到 background 响应:', response);

    if (response && response.success) {
      renderZentaoData(response.data, response.zentaoLoginError);
    } else {
      console.error('[Content Script] 数据加载失败:', response?.error);
      // 即使失败也要渲染，可能是配置未启用
      renderZentaoData(null, null);
    }
  } catch (error) {
    console.error('[Content Script] 加载禅道数据失败:', error);
    renderZentaoData(null, null);
  }
}

/**
 * 渲染禅道数据
 */
function renderZentaoData(data, loginError) {
  const zentaoModule = document.getElementById('zentaoModule');
  const zentaoLoading = document.getElementById('zentaoLoading');
  const zentaoData = document.getElementById('zentaoData');
  const zentaoLoginReminder = document.getElementById('zentaoLoginReminder');
  const zentaoLoginLink = document.getElementById('zentaoLoginLink');

  if (!zentaoModule) return;

  // 隐藏加载状态
  if (zentaoLoading) {
    zentaoLoading.style.display = 'none';
  }

  // 检查是否启用了禅道
  chrome.storage.local.get(['systems'], (result) => {
    const config = result.systems || {};
    const zentaoConfig = config.zentao || {};

    if (!zentaoConfig.enabled) {
      // 未启用，隐藏模块
      zentaoModule.style.display = 'none';
      return;
    }

    // 已启用，显示模块
    zentaoModule.style.display = 'block';

    // 检查登录状态
    if (loginError) {
      zentaoData.style.display = 'none';
      zentaoLoginReminder.style.display = 'flex';
      zentaoLoginLink.href = loginError.loginUrl || zentaoConfig.baseURL;
      return;
    }

    if (!data || !data.zentao) {
      return;
    }

    // 显示数据，隐藏登录提示
    zentaoLoginReminder.style.display = 'none';
    zentaoData.style.display = 'block';

    // 渲染任务数量
    const zentaoTasksCount = document.getElementById('zentaoTasksCount');
    if (zentaoTasksCount && data.zentao.tasks) {
      const tasks = data.zentao.tasks;
      zentaoTasksCount.textContent = tasks.length || 0;

      // 计算预计工时
      const totalEstimate = tasks.reduce((sum, task) => sum + (task.estimate || 0), 0);
      const zentaoTasksEstimateItem = document.getElementById('zentaoTasksEstimateItem');
      const zentaoTasksEstimate = document.getElementById('zentaoTasksEstimate');

      if (totalEstimate > 0 && zentaoTasksEstimateItem && zentaoTasksEstimate) {
        zentaoTasksEstimateItem.style.display = 'flex';
        zentaoTasksEstimate.textContent = `${totalEstimate.toFixed(1)} 小时`;
      } else if (zentaoTasksEstimateItem) {
        zentaoTasksEstimateItem.style.display = 'none';
      }

      // 渲染任务列表
      renderZentaoTasksSidebar(tasks);
    }

    // 渲染 Bug 数量
    const zentaoBugsCount = document.getElementById('zentaoBugsCount');
    if (zentaoBugsCount && data.zentao.bugs) {
      const bugs = data.zentao.bugs;
      zentaoBugsCount.textContent = bugs.length || 0;

      // 渲染 Bug 列表
      renderZentaoBugsSidebar(bugs);
    }
  });
}

/**
 * 渲染侧边栏任务列表
 */
function renderZentaoTasksSidebar(tasks) {
  const toggleBtn = document.getElementById('toggleTasksBtnSidebar');
  const listElem = document.getElementById('zentaoTasksListSidebar');

  if (!listElem) return;

  const count = tasks.length;

  if (count === 0) {
    if (toggleBtn) toggleBtn.style.display = 'none';
    listElem.innerHTML = '<div class="zentao-empty">暂无待处理任务</div>';
    return;
  }

  // 显示展开按钮
  if (toggleBtn) toggleBtn.style.display = 'inline-block';

  // 渲染任务列表
  let html = '';
  tasks.forEach(task => {
    const statusInfo = task.status === '已完成'
      ? { class: 'task-completed', text: '完成' }
      : { class: 'task-pending', text: '未完成' };

    html += `
      <div class="zentao-item-mini">
        <div class="zentao-content-mini">
          <div class="zentao-title-mini">
            ${task.url ? `<a href="${task.url}" target="_blank">${task.name}</a>` : task.name}
          </div>
          <span class="zentao-status-mini ${statusInfo.class}">${statusInfo.text}</span>
        </div>
      </div>
    `;
  });

  listElem.innerHTML = html;
}

/**
 * 渲染侧边栏 Bug 列表
 */
function renderZentaoBugsSidebar(bugs) {
  const toggleBtn = document.getElementById('toggleBugsBtnSidebar');
  const listElem = document.getElementById('zentaoBugsListSidebar');

  if (!listElem) return;

  const count = bugs.length;

  if (count === 0) {
    if (toggleBtn) toggleBtn.style.display = 'none';
    listElem.innerHTML = '<div class="zentao-empty">暂无待修复 Bug</div>';
    return;
  }

  // 显示展开按钮
  if (toggleBtn) toggleBtn.style.display = 'inline-block';

  // 渲染 Bug 列表
  let html = '';
  bugs.forEach(bug => {
    const statusMap = {
      active: { class: 'bug-active', text: '待处理' },
      resolved: { class: 'bug-resolved', text: '已解决' },
      closed: { class: 'bug-closed', text: '已关闭' }
    };
    const statusInfo = statusMap[bug.status] || { class: '', text: bug.status };

    html += `
      <div class="zentao-item-mini">
        <div class="zentao-content-mini">
          <div class="zentao-title-mini">
            ${bug.url ? `<a href="${bug.url}" target="_blank">${bug.title}</a>` : bug.title}
          </div>
          <span class="zentao-status-mini ${statusInfo.class}">${statusInfo.text}</span>
        </div>
      </div>
    `;
  });

  listElem.innerHTML = html;
}

/**
 * 展开/收起侧边栏禅道列表
 */
function toggleZentaoListSidebar(type) {
  const btnMap = {
    tasks: document.getElementById('toggleTasksBtnSidebar'),
    bugs: document.getElementById('toggleBugsBtnSidebar')
  };

  const listMap = {
    tasks: document.getElementById('zentaoTasksListSidebar'),
    bugs: document.getElementById('zentaoBugsListSidebar')
  };

  const btn = btnMap[type];
  const list = listMap[type];

  if (!btn || !list) return;

  const isExpanded = list.classList.contains('expanded');

  if (isExpanded) {
    // 收起
    list.classList.remove('expanded');
    btn.classList.remove('active');
    btn.textContent = '展开 ▼';
  } else {
    // 展开
    list.classList.add('expanded');
    list.style.display = 'block';
    btn.classList.add('active');
    btn.textContent = '收起 ▲';
  }
}

/**
 * 生成 Bug AI 总结
 */
async function generateBugSummary() {
  console.log('[Content Script] 开始生成 Bug 总结');

  const bugSummaryLoading = document.getElementById('bugSummaryLoading');
  const bugSummaryResult = document.getElementById('bugSummaryResult');
  const bugSummaryError = document.getElementById('bugSummaryError');
  const bugSummaryContent = document.getElementById('bugSummaryContent');
  const generateBugSummaryBtn = document.getElementById('generateBugSummaryBtn');

  // 隐藏之前的结果
  if (bugSummaryResult) bugSummaryResult.style.display = 'none';
  if (bugSummaryError) bugSummaryError.style.display = 'none';

  // 显示加载状态
  if (bugSummaryLoading) bugSummaryLoading.style.display = 'flex';
  if (generateBugSummaryBtn) generateBugSummaryBtn.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'generateBugSummary'
    });

    if (response.success) {
      // 显示总结结果
      if (bugSummaryContent) bugSummaryContent.textContent = response.summary;
      if (bugSummaryResult) bugSummaryResult.style.display = 'block';
      console.log('[Content Script] Bug 总结生成成功');
    } else {
      // 显示错误
      if (bugSummaryError) {
        bugSummaryError.textContent = response.error || '生成失败';
        bugSummaryError.style.display = 'block';
      }
    }
  } catch (error) {
    console.error('[Content Script] 生成 Bug 总结失败:', error);
    if (bugSummaryError) {
      bugSummaryError.textContent = '生成失败: ' + error.message;
      bugSummaryError.style.display = 'block';
    }
  } finally {
    // 隐藏加载状态
    if (bugSummaryLoading) bugSummaryLoading.style.display = 'none';
    if (generateBugSummaryBtn) generateBugSummaryBtn.disabled = false;
  }
}

// ===== 轮播图功能 =====
let currentSlide = 0;
let totalSlides = 0;

function initCarousel() {
  console.log('[DEBUG] 初始化轮播图');
  const carousel = document.getElementById('dishCarousel');
  if (!carousel) return;

  const inner = document.getElementById('dishCarouselInner');
  const prevBtn = document.getElementById('carouselPrev');
  const nextBtn = document.getElementById('carouselNext');
  const indicators = document.querySelectorAll('.dish-carousel-indicator');

  if (!inner) return;

  totalSlides = inner.children.length;
  currentSlide = 0;
  console.log('[DEBUG] 轮播图共有', totalSlides, '张图片');

  // 绑定上一张按钮
  if (prevBtn) {
    prevBtn.addEventListener('click', (e) => {
      console.log('[DEBUG] 上一张按钮点击');
      e.preventDefault();
      e.stopPropagation();
      currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
      updateCarousel();
    });
  }

  // 绑定下一张按钮
  if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
      console.log('[DEBUG] 下一张按钮点击');
      e.preventDefault();
      e.stopPropagation();
      currentSlide = (currentSlide + 1) % totalSlides;
      updateCarousel();
    });
  }

  // 绑定指示器点击
  indicators.forEach((indicator, index) => {
    indicator.addEventListener('click', (e) => {
      console.log('[DEBUG] 指示器', index, '点击');
      e.preventDefault();
      e.stopPropagation();
      currentSlide = index;
      updateCarousel();
    });
  });

  // 初始化显示
  updateCarousel();
}

function updateCarousel() {
  const inner = document.getElementById('dishCarouselInner');
  const indicators = document.querySelectorAll('.dish-carousel-indicator');

  if (!inner) return;

  // 更新轮播位置
  inner.style.transform = `translateX(-${currentSlide * 100}%)`;

  // 更新指示器状态
  indicators.forEach((indicator, index) => {
    if (index === currentSlide) {
      indicator.classList.add('active');
    } else {
      indicator.classList.remove('active');
    }
  });
}
