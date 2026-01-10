/**
 * 食堂菜单图标注入 - Content Script
 * 在 OA 页面注入侧边栏和菜品详情功能
 */

// ===== 状态管理 =====
let isIconInjectionEnabled = false;
let isSidebarOpen = false;

// ===== 初始化 =====
(function init() {
  console.log('[Content Script] 工作增强工具已加载');

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
    <div class="sidebar-trigger" id="sidebarTrigger">
      <i class="trigger-icon">⚡</i>
      <span class="trigger-text">增强工具</span>
    </div>

    <!-- 侧边栏主体 -->
    <div class="sidebar-panel" id="sidebarPanel">
      <div class="sidebar-header">
        <h2>工作增强工具</h2>
        <button class="sidebar-close" id="sidebarClose">✕</button>
      </div>

      <div class="sidebar-body">
        <!-- 食堂菜单增强 -->
        <div class="feature-module">
          <div class="module-header">
            <span class="module-icon">🍽️</span>
            <span class="module-title">食堂菜单增强</span>
          </div>
          <div class="module-content">
            <div class="module-desc">为菜品添加详情图标，查看 AI 分析的食材、做法等信息</div>
            <div class="module-control">
              <label class="switch">
                <input type="checkbox" id="dishIconToggle">
                <span class="slider"></span>
              </label>
              <span class="status-text" id="dishIconStatus">未启用</span>
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

    <!-- 遮罩层 -->
    <div class="sidebar-overlay" id="sidebarOverlay"></div>
  `;

  document.body.appendChild(sidebar);

  // 绑定事件
  bindSidebarEvents();
}

// ===== 绑定侧边栏事件 =====
function bindSidebarEvents() {
  const trigger = document.getElementById('sidebarTrigger');
  const panel = document.getElementById('sidebarPanel');
  const overlay = document.getElementById('sidebarOverlay');
  const closeBtn = document.getElementById('sidebarClose');
  const toggle = document.getElementById('dishIconToggle');
  const statusText = document.getElementById('dishIconStatus');

  // 打开侧边栏
  trigger.addEventListener('click', () => {
    openSidebar();
  });

  // 关闭侧边栏
  closeBtn.addEventListener('click', () => {
    closeSidebar();
  });

  overlay.addEventListener('click', () => {
    closeSidebar();
  });

  // 食堂菜单增强开关
  toggle.addEventListener('change', async (e) => {
    isIconInjectionEnabled = e.target.checked;
    statusText.textContent = isIconInjectionEnabled ? '已启用' : '未启用';

    if (isIconInjectionEnabled) {
      console.log('[Content Script] 用户启用食堂菜单增强');
      await waitForIframeAndInject();
    } else {
      console.log('[Content Script] 用户禁用食堂菜单增强');
      removeAllIcons();
    }
  });
}

// 打开侧边栏
function openSidebar() {
  isSidebarOpen = true;
  document.getElementById('sidebarPanel').classList.add('active');
  document.getElementById('sidebarOverlay').classList.add('active');
  console.log('[Content Script] 侧边栏已打开');
}

// 关闭侧边栏
function closeSidebar() {
  isSidebarOpen = false;
  document.getElementById('sidebarPanel').classList.remove('active');
  document.getElementById('sidebarOverlay').classList.remove('active');
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

// 提取菜品名称（从最后一个括号中提取）
function extractDishName(text) {
  // 尝试多种格式
  // 格式1: "午餐A（25元）(啤酒鸭)"
  let match = text.match(/\(([^)]+)\)$/);
  if (match) return match[1].trim();

  // 格式2: "午餐A（25元）（啤酒鸭）" - 全角括号
  match = text.match(/（([^）]+)）$/);
  if (match) return match[1].trim();

  // 格式3: "(啤酒鸭)" 或 "（啤酒鸭）" 出现在任意位置
  match = text.match(/[(（]([^)）]+)[)）]/);
  if (match) return match[1].trim();

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
    // 判断餐别（根据当前时间）
    const mealType = getCurrentMealType();

    // 向 Background 请求数据
    const response = await chrome.runtime.sendMessage({
      action: 'getDishDetail',
      dishName: dishName,
      mealType: mealType
    });

    if (response.success) {
      renderModalContent(response.data);
    } else {
      showModalError(response.error || '获取菜品信息失败');
    }
  } catch (error) {
    console.error('[Content Script] 获取菜品详情失败:', error);
    showModalError('网络请求失败，请检查配置');
  }
}

// 创建 Modal 结构（居中弹窗）
function createDishModal() {
  // 如果已存在，先移除
  const existing = document.getElementById('dish-detail-modal');
  if (existing) existing.remove();

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

  // 添加显示动画
  setTimeout(() => modal.classList.add('active'), 10);

  // 绑定关闭事件
  document.getElementById('dishModalOverlay').addEventListener('click', closeDishModal);
  document.getElementById('closeModalBtn').addEventListener('click', closeDishModal);

  // ESC 键关闭
  document.addEventListener('keydown', handleEscKey);
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

  modalBody.innerHTML = `
    <div class="dish-detail">
      ${dishData.imageUrl ?
        `<img src="${dishData.imageUrl}" alt="${dishData.dishName}" class="dish-image">` :
        `<div class="dish-image-placeholder">
          <span class="placeholder-icon">🍽️</span>
          <p>暂无图片</p>
        </div>`
      }

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
}

// 显示错误信息
function showModalError(message) {
  const modalBody = document.getElementById('dishModalBody');
  modalBody.innerHTML = `
    <div class="error-message">
      <span class="error-icon">⚠️</span>
      <p>${message}</p>
      <button class="retry-btn" onclick="document.getElementById('closeModalBtn').click()">关闭</button>
    </div>
  `;
}

// 关闭 Modal
function closeDishModal() {
  const modal = document.getElementById('dish-detail-modal');
  if (!modal) return;

  modal.classList.remove('active');
  setTimeout(() => modal.remove(), 300);

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
