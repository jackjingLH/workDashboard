/**
 * 工作流聚合助手 - Popup 页面脚本
 */

// DOM 元素
const elements = {
  refreshBtn: document.getElementById('refreshBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  loading: document.getElementById('loading'),
  content: document.getElementById('content'),
  settingsPanel: document.getElementById('settingsPanel'),
  dashboardPanel: document.getElementById('dashboardPanel'),
  lastUpdateTime: document.getElementById('lastUpdateTime'),
  emptyState: document.getElementById('emptyState'),

  // 设置面板元素
  saveConfigBtn: document.getElementById('saveConfigBtn'),
  cancelConfigBtn: document.getElementById('cancelConfigBtn'),
  oaEnabled: document.getElementById('oaEnabled'),
  oaUrl: document.getElementById('oaUrl'),
  zentaoEnabled: document.getElementById('zentaoEnabled'),
  zentaoUrl: document.getElementById('zentaoUrl'),
  gitlabEnabled: document.getElementById('gitlabEnabled'),
  gitlabUrl: document.getElementById('gitlabUrl'),

  // 数据展示区域
  oaSection: document.getElementById('oaSection'),
  oaDateRange: document.getElementById('oaDateRange'),
  oaLoginReminder: document.getElementById('oaLoginReminder'),
  oaLoginLink: document.getElementById('oaLoginLink'),
  oaDataContent: document.getElementById('oaDataContent'),
  oaLogStatus: document.getElementById('oaLogStatus'),
  oaLogCount: document.getElementById('oaLogCount'),
  oaLogReminder: document.getElementById('oaLogReminder'),
  toggleCanteenBtn: document.getElementById('toggleCanteenBtn'),
  canteenMenuList: document.getElementById('canteenMenuList'),
  zentaoSection: document.getElementById('zentaoSection'),
  gitlabSection: document.getElementById('gitlabSection'),

  // AI 总结相关
  aiProvider: document.getElementById('aiProvider'),
  aiApiKey: document.getElementById('aiApiKey'),
  aiProviderLink: document.getElementById('aiProviderLink'),
  generateSummaryBtn: document.getElementById('generateSummaryBtn'),
  summaryLoading: document.getElementById('summaryLoading'),
  summaryResult: document.getElementById('summaryResult'),
  summaryContent: document.getElementById('summaryContent'),
  summaryError: document.getElementById('summaryError'),

  // SerpAPI 图片搜索相关
  serpapiEngine: document.getElementById('serpapiEngine'),
  serpapiApiKey: document.getElementById('serpapiApiKey')
};

// 当前配置
let currentConfig = null;

// 页面加载完成
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup 页面加载完成');

  // 绑定事件
  bindEvents();

  // 加载配置
  await loadConfig();

  // 加载数据
  await loadData();
});

/**
 * 绑定事件
 */
function bindEvents() {
  // 刷新按钮
  elements.refreshBtn.addEventListener('click', async () => {
    await refreshData();
  });

  // 设置按钮
  elements.settingsBtn.addEventListener('click', () => {
    showSettings();
  });

  // 保存配置
  elements.saveConfigBtn.addEventListener('click', async () => {
    await saveConfig();
  });

  // 取消配置
  elements.cancelConfigBtn.addEventListener('click', () => {
    hideSettings();
  });

  // 生成工作总结
  elements.generateSummaryBtn.addEventListener('click', async () => {
    await generateSummary();
  });

  // AI 服务商切换
  elements.aiProvider.addEventListener('change', () => {
    updateAIProviderLink();
  });

  // OA 日期范围切换
  elements.oaDateRange.addEventListener('change', async () => {
    await onOADateRangeChange();
  });

  // 食堂菜单展开/收起
  elements.toggleCanteenBtn.addEventListener('click', () => {
    toggleCanteenMenu();
  });

  // 食堂菜单菜品点击事件
  bindCanteenEvents();
}

/**
 * 加载配置
 */
async function loadConfig() {
  try {
    const response = await sendMessage({ action: 'getConfig' });
    if (response.success) {
      currentConfig = response.systems;
      updateSettingsForm(currentConfig);
    }

    // 加载 SerpAPI 配置
    const serpapiResult = await chrome.storage.local.get(['serpapi']);
    if (serpapiResult.serpapi) {
      elements.serpapiEngine.value = serpapiResult.serpapi.engine || 'bing';
      elements.serpapiApiKey.value = serpapiResult.serpapi.apiKey || '';
    }
  } catch (error) {
    console.error('加载配置失败:', error);
  }
}

/**
 * 更新设置表单
 */
function updateSettingsForm(config) {
  if (!config) return;

  elements.oaEnabled.checked = config.oa?.enabled || false;
  elements.oaUrl.value = config.oa?.baseURL || '';

  elements.zentaoEnabled.checked = config.zentao?.enabled || false;
  elements.zentaoUrl.value = config.zentao?.baseURL || '';

  elements.gitlabEnabled.checked = config.gitlab?.enabled || false;
  elements.gitlabUrl.value = config.gitlab?.baseURL || '';

  elements.aiProvider.value = config.zhipu?.provider || 'zhipu';
  elements.aiApiKey.value = config.zhipu?.apiKey || '';

  updateAIProviderLink();
}

/**
 * 保存配置
 */
async function saveConfig() {
  const config = {
    oa: {
      name: 'OA系统',
      enabled: elements.oaEnabled.checked,
      baseURL: elements.oaUrl.value.trim(),
      apiURL: elements.oaUrl.value.trim().replace('/web/home/index', ''),
      dateRange: currentConfig?.oa?.dateRange || 'today'
    },
    zentao: {
      name: '禅道',
      enabled: elements.zentaoEnabled.checked,
      baseURL: elements.zentaoUrl.value.trim()
    },
    gitlab: {
      name: 'GitLab',
      enabled: elements.gitlabEnabled.checked,
      baseURL: elements.gitlabUrl.value.trim()
    },
    zhipu: {
      name: '智谱AI',
      enabled: elements.aiApiKey.value.trim() !== '',
      provider: elements.aiProvider.value,
      apiKey: elements.aiApiKey.value.trim()
    }
  };

  // SerpAPI 配置（单独保存）
  const serpapiConfig = {
    engine: elements.serpapiEngine.value,
    apiKey: elements.serpapiApiKey.value.trim()
  };

  try {
    // 保存系统配置
    const response = await sendMessage({
      action: 'saveConfig',
      systems: config
    });

    // 保存 SerpAPI 配置到 chrome.storage
    await chrome.storage.local.set({ serpapi: serpapiConfig });

    if (response.success) {
      currentConfig = config;
      alert('配置保存成功！');
      hideSettings();
      await refreshData();
    }
  } catch (error) {
    console.error('保存配置失败:', error);
    alert('保存配置失败: ' + error.message);
  }
}

/**
 * 显示设置面板
 */
function showSettings() {
  elements.settingsPanel.style.display = 'block';
  elements.dashboardPanel.style.display = 'none';
}

/**
 * 隐藏设置面板
 */
function hideSettings() {
  elements.settingsPanel.style.display = 'none';
  elements.dashboardPanel.style.display = 'block';
}

/**
 * 加载数据
 */
async function loadData() {
  try {
    const result = await chrome.storage.local.get(['data', 'lastUpdate', 'errors', 'oaLoginError']);

    if (result.lastUpdate) {
      updateLastUpdateTime(result.lastUpdate);
    }

    if (result.data) {
      renderData(result.data, result.oaLoginError);
    } else {
      showEmptyState();
    }

    if (result.errors && result.errors.length > 0) {
      console.warn('部分系统数据获取失败:', result.errors);
    }
  } catch (error) {
    console.error('加载数据失败:', error);
    showEmptyState();
  }
}

/**
 * 刷新数据
 */
async function refreshData() {
  showLoading();

  try {
    const response = await sendMessage({ action: 'refreshData' });

    if (response.success) {
      // 刷新后重新从 storage 读取所有数据（包括 oaLoginError）
      const result = await chrome.storage.local.get(['data', 'lastUpdate', 'oaLoginError']);

      renderData(result.data, result.oaLoginError);
      updateLastUpdateTime(new Date().toISOString());
    } else {
      alert('刷新失败: ' + response.error);
    }
  } catch (error) {
    console.error('刷新数据失败:', error);
    alert('刷新失败: ' + error.message);
  } finally {
    hideLoading();
  }
}

/**
 * 渲染数据
 */
function renderData(data, oaLoginError) {
  console.log('renderData 被调用，oaLoginError:', oaLoginError);
  let hasData = false;

  // 渲染 OA 数据
  if (currentConfig?.oa?.enabled) {
    elements.oaSection.style.display = 'block';

    // 检查是否需要登录
    if (oaLoginError) {
      console.log('显示 OA 登录提示，登录 URL:', oaLoginError.loginUrl);
      elements.oaLoginReminder.style.display = 'block';
      elements.oaDataContent.style.display = 'none';
      elements.oaLoginLink.href = oaLoginError.loginUrl || currentConfig.oa.baseURL;
      hasData = true;
    } else if (data.oa) {
      elements.oaLoginReminder.style.display = 'none';
      elements.oaDataContent.style.display = 'block';

      // 设置日期范围选择器
      if (currentConfig.oa.dateRange) {
        elements.oaDateRange.value = currentConfig.oa.dateRange;
      }

      // 显示日志状态
      const hasLog = data.oa.hasLog;
      const logCount = data.oa.logCount || 0;

      elements.oaLogStatus.textContent = hasLog ? '已填写' : '未填写';
      elements.oaLogStatus.className = 'value ' + (hasLog ? 'success' : 'error');
      elements.oaLogCount.textContent = logCount;

      // 显示/隐藏未填写提醒（仅当查询今天且未填写时）
      const dateRange = currentConfig.oa.dateRange || 'today';
      if (dateRange === 'today' && !hasLog) {
        elements.oaLogReminder.style.display = 'block';
      } else {
        elements.oaLogReminder.style.display = 'none';
      }

      // 渲染食堂菜单
      if (data.oa.canteen && data.oa.canteen.weekMenu) {
        renderCanteenMenu(data.oa.canteen.weekMenu);
      }

      hasData = true;
    }
  } else {
    elements.oaSection.style.display = 'none';
  }

  // 渲染禅道数据
  if (currentConfig?.zentao?.enabled && data.zentao) {
    elements.zentaoSection.style.display = 'block';

    if (data.zentao.mock) {
      document.getElementById('zentaoTasks').textContent = '待实现';
      document.getElementById('zentaoBugs').textContent = '待实现';
      document.getElementById('zentaoStories').textContent = '待实现';
    } else {
      document.getElementById('zentaoTasks').textContent = data.zentao.tasks || 0;
      document.getElementById('zentaoBugs').textContent = data.zentao.bugs || 0;
      document.getElementById('zentaoStories').textContent = data.zentao.stories || 0;
    }

    hasData = true;
  } else {
    elements.zentaoSection.style.display = 'none';
  }

  // 渲染 GitLab 数据
  if (currentConfig?.gitlab?.enabled && data.gitlab) {
    elements.gitlabSection.style.display = 'block';

    if (data.gitlab.mock) {
      document.getElementById('gitlabCommits').textContent = '待实现';
    } else {
      document.getElementById('gitlabCommits').textContent = data.gitlab.todayCommits || 0;
    }

    hasData = true;
  } else {
    elements.gitlabSection.style.display = 'none';
  }

  // 显示或隐藏空状态
  elements.emptyState.style.display = hasData ? 'none' : 'block';
}

/**
 * 显示空状态
 */
function showEmptyState() {
  elements.oaSection.style.display = 'none';
  elements.zentaoSection.style.display = 'none';
  elements.gitlabSection.style.display = 'none';
  elements.emptyState.style.display = 'block';
}

/**
 * 更新最后更新时间
 */
function updateLastUpdateTime(timestamp) {
  if (!timestamp) {
    elements.lastUpdateTime.textContent = '未更新';
    return;
  }

  const date = new Date(timestamp);
  const timeStr = date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  elements.lastUpdateTime.textContent = `最后更新: ${timeStr}`;
}

/**
 * 显示加载中
 */
function showLoading() {
  elements.loading.style.display = 'flex';
  elements.content.style.opacity = '0.5';
}

/**
 * 隐藏加载中
 */
function hideLoading() {
  elements.loading.style.display = 'none';
  elements.content.style.opacity = '1';
}

/**
 * 更新 AI 服务商链接
 */
function updateAIProviderLink() {
  const provider = elements.aiProvider.value;
  const links = {
    zhipu: { url: 'https://open.bigmodel.cn/', text: 'open.bigmodel.cn' },
    aliyun: { url: 'https://dashscope.aliyun.com/', text: 'dashscope.aliyun.com' },
    openai: { url: 'https://platform.openai.com/', text: 'platform.openai.com' },
    relay: { url: 'https://co.yes.vg/', text: 'co.yes.vg (中转服务)' }
  };

  const link = links[provider] || links.zhipu;
  elements.aiProviderLink.href = link.url;
  elements.aiProviderLink.textContent = link.text;
}

/**
 * 生成工作总结
 */
async function generateSummary() {
  console.log('开始生成工作总结...');

  // 隐藏之前的结果和错误
  elements.summaryResult.style.display = 'none';
  elements.summaryError.style.display = 'none';

  // 显示加载状态
  elements.summaryLoading.style.display = 'block';
  elements.generateSummaryBtn.disabled = true;

  try {
    const response = await sendMessage({ action: 'generateSummary' });

    if (response.success) {
      // 显示总结结果
      elements.summaryContent.textContent = response.summary;
      elements.summaryResult.style.display = 'block';
      console.log('总结生成成功:', response.summary);
    } else {
      // 显示错误
      elements.summaryError.textContent = response.error || '生成失败';
      elements.summaryError.style.display = 'block';
    }
  } catch (error) {
    console.error('生成总结失败:', error);
    elements.summaryError.textContent = '生成失败: ' + error.message;
    elements.summaryError.style.display = 'block';
  } finally {
    // 隐藏加载状态
    elements.summaryLoading.style.display = 'none';
    elements.generateSummaryBtn.disabled = false;
  }
}

/**
 * 渲染食堂菜单
 */
function renderCanteenMenu(weekMenu) {
  if (!weekMenu || weekMenu.length === 0) {
    elements.canteenMenuList.innerHTML = '<p style="text-align: center; color: #999; padding: 12px;">暂无菜单数据</p>';
    return;
  }

  let html = '';

  weekMenu.forEach(day => {
    html += `<div class="canteen-day">`;
    html += `<div class="canteen-day-header">${day.date} ${day.weekday}</div>`;

    // 渲染早餐
    if (day.meals.breakfast && day.meals.breakfast.length > 0) {
      html += `<div class="canteen-meal-type">`;
      html += `<div class="canteen-meal-label">🌅 早餐</div>`;
      html += `<div class="canteen-meal-items">`;
      day.meals.breakfast.forEach(meal => {
        const dishName = meal.dish || meal.mealName;
        html += `<div class="canteen-meal-tag clickable-dish" data-dish-name="${dishName}" data-meal-type="breakfast" title="点击查看详情">`;
        html += `<span class="canteen-meal-name">${meal.mealName}</span>`;
        if (meal.dish) {
          html += `<span class="canteen-dish">${meal.dish}</span>`;
        }
        html += `</div>`;
      });
      html += `</div></div>`;
    }

    // 渲染午餐
    if (day.meals.lunch && day.meals.lunch.length > 0) {
      html += `<div class="canteen-meal-type">`;
      html += `<div class="canteen-meal-label">🍱 午餐</div>`;
      html += `<div class="canteen-meal-items">`;
      day.meals.lunch.forEach(meal => {
        const dishName = meal.dish || meal.mealName;
        html += `<div class="canteen-meal-tag clickable-dish" data-dish-name="${dishName}" data-meal-type="lunch" title="点击查看详情">`;
        html += `<span class="canteen-meal-name">${meal.mealName}</span>`;
        if (meal.dish) {
          html += `<span class="canteen-dish">${meal.dish}</span>`;
        }
        html += `</div>`;
      });
      html += `</div></div>`;
    }

    // 渲染晚餐
    if (day.meals.dinner && day.meals.dinner.length > 0) {
      html += `<div class="canteen-meal-type">`;
      html += `<div class="canteen-meal-label">🌙 晚餐</div>`;
      html += `<div class="canteen-meal-items">`;
      day.meals.dinner.forEach(meal => {
        const dishName = meal.dish || meal.mealName;
        html += `<div class="canteen-meal-tag clickable-dish" data-dish-name="${dishName}" data-meal-type="dinner" title="点击查看详情">`;
        html += `<span class="canteen-meal-name">${meal.mealName}</span>`;
        if (meal.dish) {
          html += `<span class="canteen-dish">${meal.dish}</span>`;
        }
        html += `</div>`;
      });
      html += `</div></div>`;
    }

    html += `</div>`;
  });

  elements.canteenMenuList.innerHTML = html;
}

/**
 * 绑定食堂菜单事件（事件委托）
 * @see docs/canteen/event-handling.md 事件处理文档
 * @see CLAUDE.md 项目规范
 */
function bindCanteenEvents() {
  const canteenMenuList = document.getElementById('canteenMenuList');
  if (!canteenMenuList) return;

  // 使用事件委托处理菜品点击
  canteenMenuList.addEventListener('click', (e) => {
    const dishTag = e.target.closest('.clickable-dish');
    if (dishTag) {
      onDishTagClick(dishTag);
    }
  });
}

/**
 * 处理菜品标签点击事件
 * @param {HTMLElement} tagElement - 被点击的标签元素
 * @see docs/canteen/dish-click-handler.md 点击处理流程
 * @see CLAUDE.md 项目规范
 */
async function onDishTagClick(tagElement) {
  const dishName = tagElement.dataset.dishName;
  const mealType = tagElement.dataset.mealType;

  if (!dishName || !mealType) {
    console.error('菜品数据不完整');
    return;
  }

  // 防抖：避免重复点击
  if (tagElement.classList.contains('loading')) {
    return;
  }

  tagElement.classList.add('loading');

  try {
    // 1. 显示加载状态
    showDishSidebar(null, true);

    // 2. 请求菜品详情
    const response = await sendMessage({
      action: 'getDishDetail',
      dishName,
      mealType
    });

    if (response.success) {
      // 3. 显示详情
      showDishSidebar(response.data, false);
    } else {
      throw new Error(response.error || '获取失败');
    }

  } catch (error) {
    console.error('获取菜品详情失败:', error);
    showDishSidebar({
      dishName,
      intro: '获取详情失败，请稍后重试',
      ingredients: [],
      cookingMethods: [],
      cookingSteps: [],
      imageUrl: '',
      error: error.message
    }, false);

  } finally {
    tagElement.classList.remove('loading');
  }
}

/**
 * 显示菜品详情侧边栏
 * @param {Object|null} dishData - 菜品数据（null表示加载中）
 * @param {boolean} isLoading - 是否显示加载状态
 * @see docs/canteen/sidebar-ui.md 侧边栏UI文档
 * @see CLAUDE.md 项目规范
 */
function showDishSidebar(dishData, isLoading) {
  const sidebar = document.getElementById('dish-sidebar');
  const overlay = document.getElementById('dish-overlay');

  if (!sidebar || !overlay) {
    console.error('侧边栏元素未找到');
    return;
  }

  // 显示遮罩和侧边栏
  overlay.classList.add('active');
  sidebar.classList.add('active');

  if (isLoading) {
    // 显示加载骨架屏
    sidebar.innerHTML = `
      <div class="sidebar-header">
        <h3 class="skeleton-text"></h3>
        <button class="sidebar-close" id="close-dish-sidebar">×</button>
      </div>
      <div class="sidebar-content">
        <div class="dish-image-container skeleton-image"></div>
        <div class="dish-intro skeleton-text skeleton-paragraph"></div>
        <div class="dish-tags">
          <div class="skeleton-tag"></div>
          <div class="skeleton-tag"></div>
          <div class="skeleton-tag"></div>
        </div>
      </div>
    `;
  } else if (dishData) {
    // 渲染实际数据
    const hasImage = dishData.imageUrl && !dishData.error;
    const ingredientsHtml = dishData.ingredients.map(item =>
      `<span class="dish-tag ingredient-tag">${item}</span>`
    ).join('');
    const methodsHtml = dishData.cookingMethods.map(item =>
      `<span class="dish-tag method-tag">${item}</span>`
    ).join('');
    const stepsHtml = (dishData.cookingSteps || []).map((step, index) =>
      `<div class="cooking-step">
         <span class="step-number">${index + 1}</span>
         <span class="step-text">${step}</span>
       </div>`
    ).join('');

    sidebar.innerHTML = `
      <div class="sidebar-header">
        <h3>${dishData.dishName}</h3>
        <button class="sidebar-close" id="close-dish-sidebar">×</button>
      </div>
      <div class="sidebar-content">
        ${hasImage ? `
          <div class="dish-image-container">
            <img src="${dishData.imageUrl}"
                 alt="${dishData.dishName}"
                 class="dish-image"
                 onerror="this.parentElement.innerHTML='<div class=dish-image-placeholder>暂无图片</div>'">
          </div>
        ` : `
          <div class="dish-image-container">
            <div class="dish-image-placeholder">暂无图片</div>
          </div>
        `}

        <div class="dish-intro">
          <p>${dishData.intro}</p>
        </div>

        ${dishData.ingredients.length > 0 ? `
          <div class="dish-section">
            <h4>主要食材</h4>
            <div class="dish-tags">${ingredientsHtml}</div>
          </div>
        ` : ''}

        ${dishData.cookingMethods.length > 0 ? `
          <div class="dish-section">
            <h4>做法关键词</h4>
            <div class="dish-tags">${methodsHtml}</div>
          </div>
        ` : ''}

        ${dishData.cookingSteps && dishData.cookingSteps.length > 0 ? `
          <div class="dish-section">
            <h4>做法步骤</h4>
            <div class="cooking-steps">${stepsHtml}</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  // 绑定关闭事件
  bindSidebarCloseEvents();
}

/**
 * 关闭菜品详情侧边栏
 * @see docs/canteen/sidebar-ui.md 侧边栏UI文档
 * @see CLAUDE.md 项目规范
 */
function closeDishSidebar() {
  const sidebar = document.getElementById('dish-sidebar');
  const overlay = document.getElementById('dish-overlay');

  if (sidebar) sidebar.classList.remove('active');
  if (overlay) overlay.classList.remove('active');
}

/**
 * 绑定侧边栏关闭事件
 * @see docs/canteen/event-handling.md 事件处理文档
 * @see CLAUDE.md 项目规范
 */
function bindSidebarCloseEvents() {
  // 关闭按钮
  const closeBtn = document.getElementById('close-dish-sidebar');
  if (closeBtn) {
    closeBtn.onclick = closeDishSidebar;
  }

  // 遮罩层点击
  const overlay = document.getElementById('dish-overlay');
  if (overlay) {
    overlay.onclick = closeDishSidebar;
  }

  // ESC键关闭（只绑定一次）
  document.removeEventListener('keydown', handleEscapeKey);
  document.addEventListener('keydown', handleEscapeKey);
}

/**
 * 处理 ESC 键关闭侧边栏
 * @param {KeyboardEvent} e - 键盘事件
 */
function handleEscapeKey(e) {
  if (e.key === 'Escape') {
    closeDishSidebar();
  }
}

/**
 * 展开/收起食堂菜单
 */
function toggleCanteenMenu() {
  const isVisible = elements.canteenMenuList.style.display !== 'none';

  if (isVisible) {
    elements.canteenMenuList.style.display = 'none';
    elements.toggleCanteenBtn.textContent = '展开 ▼';
  } else {
    elements.canteenMenuList.style.display = 'block';
    elements.toggleCanteenBtn.textContent = '收起 ▲';
  }
}

/**
 * OA 日期范围切换
 */
async function onOADateRangeChange() {
  const dateRange = elements.oaDateRange.value;
  console.log('OA 日期范围切换:', dateRange);

  // 更新配置
  if (currentConfig && currentConfig.oa) {
    currentConfig.oa.dateRange = dateRange;

    // 保存配置到存储
    await sendMessage({
      action: 'saveConfig',
      systems: currentConfig
    });

    // 刷新数据
    await refreshData();
  }
}

/**
 * 发送消息到后台脚本
 */
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

console.log('Popup 脚本加载完成');
