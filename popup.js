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
  zentaoLoginReminder: document.getElementById('zentaoLoginReminder'),
  zentaoLoginLink: document.getElementById('zentaoLoginLink'),
  zentaoDataContent: document.getElementById('zentaoDataContent'),
  toggleTasksBtn: document.getElementById('toggleTasksBtn'),
  toggleBugsBtn: document.getElementById('toggleBugsBtn'),
  zentaoTasksList: document.getElementById('zentaoTasksList'),
  zentaoBugsList: document.getElementById('zentaoBugsList'),
  gitlabSection: document.getElementById('gitlabSection'),
  gitlabDateRange: document.getElementById('gitlabDateRange'),
  gitlabLoginReminder: document.getElementById('gitlabLoginReminder'),
  gitlabLoginLink: document.getElementById('gitlabLoginLink'),
  gitlabDataContent: document.getElementById('gitlabDataContent'),
  gitlabCommitsLabel: document.getElementById('gitlabCommitsLabel'),

  // AI 总结相关
  aiProvider: document.getElementById('aiProvider'),
  aiApiKey: document.getElementById('aiApiKey'),
  aiProviderLink: document.getElementById('aiProviderLink'),
  generateSummaryBtn: document.getElementById('generateSummaryBtn'),
  summaryLoading: document.getElementById('summaryLoading'),
  summaryResult: document.getElementById('summaryResult'),
  summaryContent: document.getElementById('summaryContent'),
  summaryError: document.getElementById('summaryError'),

  // Bug AI 总结相关
  generateBugSummaryBtn: document.getElementById('generateBugSummaryBtn'),
  bugSummaryLoading: document.getElementById('bugSummaryLoading'),
  bugSummaryResult: document.getElementById('bugSummaryResult'),
  bugSummaryContent: document.getElementById('bugSummaryContent'),
  bugSummaryError: document.getElementById('bugSummaryError'),

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

  // GitLab 日期范围切换
  elements.gitlabDateRange.addEventListener('change', async () => {
    await onGitLabDateRangeChange();
  });

  // 食堂菜单展开/收起
  elements.toggleCanteenBtn.addEventListener('click', () => {
    toggleCanteenMenu();
  });

  // 禅道任务展开/收起
  if (elements.toggleTasksBtn) {
    elements.toggleTasksBtn.addEventListener('click', () => {
      toggleZentaoList('tasks');
    });
  }

  // 禅道Bug展开/收起
  if (elements.toggleBugsBtn) {
    elements.toggleBugsBtn.addEventListener('click', () => {
      toggleZentaoList('bugs');
    });
  }

  // Bug AI 总结
  if (elements.generateBugSummaryBtn) {
    elements.generateBugSummaryBtn.addEventListener('click', async () => {
      await generateBugSummary();
    });
  }

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
      baseURL: elements.gitlabUrl.value.trim(),
      dateRange: currentConfig?.gitlab?.dateRange || 'today'
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
    const result = await chrome.storage.local.get(['data', 'lastUpdate', 'errors', 'oaLoginError', 'zentaoLoginError', 'gitlabLoginError']);

    if (result.lastUpdate) {
      updateLastUpdateTime(result.lastUpdate);
    }

    if (result.data) {
      renderData(result.data, result.oaLoginError, result.zentaoLoginError, result.gitlabLoginError);
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
      // 刷新后重新从 storage 读取所有数据（包括所有登录错误）
      const result = await chrome.storage.local.get(['data', 'lastUpdate', 'oaLoginError', 'zentaoLoginError', 'gitlabLoginError']);

      renderData(result.data, result.oaLoginError, result.zentaoLoginError, result.gitlabLoginError);
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
function renderData(data, oaLoginError, zentaoLoginError, gitlabLoginError) {
  console.log('renderData 被调用，oaLoginError:', oaLoginError, 'zentaoLoginError:', zentaoLoginError, 'gitlabLoginError:', gitlabLoginError);
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
  if (currentConfig?.zentao?.enabled) {
    elements.zentaoSection.style.display = 'block';

    // 检查是否需要登录
    if (zentaoLoginError) {
      console.log('显示禅道登录提示，登录 URL:', zentaoLoginError.loginUrl);
      elements.zentaoLoginReminder.style.display = 'block';
      elements.zentaoDataContent.style.display = 'none';
      elements.zentaoLoginLink.href = zentaoLoginError.loginUrl || currentConfig.zentao.baseURL;
      hasData = true;
    } else if (data.zentao) {
      elements.zentaoLoginReminder.style.display = 'none';
      elements.zentaoDataContent.style.display = 'block';

      // 渲染禅道详细数据
      renderZentaoData(data.zentao);

      hasData = true;
    }
  } else {
    elements.zentaoSection.style.display = 'none';
  }

  // 渲染 GitLab 数据
  if (currentConfig?.gitlab?.enabled) {
    elements.gitlabSection.style.display = 'block';

    // 检查是否需要登录
    if (gitlabLoginError) {
      console.log('显示 GitLab 登录提示，登录 URL:', gitlabLoginError.loginUrl);
      elements.gitlabLoginReminder.style.display = 'block';
      elements.gitlabDataContent.style.display = 'none';
      elements.gitlabLoginLink.href = gitlabLoginError.loginUrl || currentConfig.gitlab.baseURL;
      hasData = true;
    } else if (data.gitlab) {
      elements.gitlabLoginReminder.style.display = 'none';
      elements.gitlabDataContent.style.display = 'block';

      // 设置日期范围选择器
      if (currentConfig.gitlab.dateRange) {
        elements.gitlabDateRange.value = currentConfig.gitlab.dateRange;
      }

      // 根据日期范围更新标签文本
      const dateRange = currentConfig.gitlab.dateRange || 'today';
      const labelMap = {
        today: '今日提交:',
        week: '本周提交:',
        month: '本月提交:'
      };
      elements.gitlabCommitsLabel.textContent = labelMap[dateRange] || '今日提交:';

      if (data.gitlab.mock) {
        document.getElementById('gitlabCommits').textContent = '待实现';
      } else {
        // 渲染提交次数
        document.getElementById('gitlabCommits').textContent = data.gitlab.commits || 0;

        // 渲染 MR 统计（仅显示合并数量）
        if (data.gitlab.mergeRequests && data.gitlab.mergeRequests.merged > 0) {
          document.getElementById('gitlabMrItem').style.display = 'flex';
          document.getElementById('gitlabMR').textContent = data.gitlab.mergeRequests.merged;
        } else {
          document.getElementById('gitlabMrItem').style.display = 'none';
        }

        // 渲染项目分布
        if (data.gitlab.projects && Object.keys(data.gitlab.projects).length > 0) {
          document.getElementById('gitlabProjectsItem').style.display = 'flex';
          const allProjects = Object.entries(data.gitlab.projects)
            .sort((a, b) => b[1] - a[1]) // 按提交次数排序
            .map(([name, count]) => `${name}(${count})`)
            .join(', ');
          document.getElementById('gitlabProjects').textContent = allProjects;
        } else {
          document.getElementById('gitlabProjectsItem').style.display = 'none';
        }

        // 更新 AI 工作总结按钮文本
        const summaryBtnTextMap = {
          today: '🤖 生成今日工作总结',
          week: '🤖 生成本周工作总结',
          month: '🤖 生成本月工作总结'
        };
        const summaryBtnText = document.getElementById('generateSummaryBtnText');
        if (summaryBtnText) {
          summaryBtnText.textContent = summaryBtnTextMap[dateRange] || '🤖 生成工作总结';
        }

        // 更新总结标题
        const summaryResultTitle = document.querySelector('.summary-result h4');
        if (summaryResultTitle) {
          const titleMap = {
            today: '📝 今日工作总结',
            week: '📝 本周工作总结',
            month: '📝 本月工作总结'
          };
          summaryResultTitle.textContent = titleMap[dateRange] || '📝 工作总结';
        }
      }

      hasData = true;
    }
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

    // 2. 先检查配置
    console.log('[Popup] 检查 API 配置...');
    const configCheck = await sendMessage({
      action: 'checkApiConfig'
    });

    // 3. 如果缺少必需配置（AI API），显示配置引导
    if (!configCheck.success) {
      showDishSidebar({
        dishName,
        intro: '',
        ingredients: [],
        cookingMethods: [],
        cookingSteps: [],
        imageUrl: '',
        configError: true,
        errorMessage: configCheck.message
      }, false);
      return;
    }

    // 4. 如果有警告（SerpAPI 未配置），在 console 提示但继续
    if (configCheck.warning) {
      console.warn('[Popup]', configCheck.message);
    }

    // 5. 请求菜品详情
    console.log('[Popup] 开始获取菜品详情...');
    const response = await sendMessage({
      action: 'getDishDetail',
      dishName,
      mealType
    });

    if (response.success) {
      // 6. 显示详情
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
  } else if (dishData && dishData.configError) {
    // 显示配置错误引导
    sidebar.innerHTML = `
      <div class="sidebar-header">
        <h3>${dishData.dishName}</h3>
        <button class="sidebar-close" id="close-dish-sidebar">×</button>
      </div>
      <div class="sidebar-content">
        <div class="config-error-message">
          <div class="config-error-icon">⚙️</div>
          <div class="config-error-text">${dishData.errorMessage.replace(/\n/g, '<br>')}</div>
          <button class="config-error-btn" id="goToSettings">前往设置</button>
        </div>
      </div>
    `;
  } else if (dishData) {
    // 渲染实际数据
    const hasImages = dishData.imageUrls && dishData.imageUrls.length > 0;
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

    // 生成轮播图 HTML
    let carouselHtml = '';
    if (hasImages) {
      const carouselItemsHtml = dishData.imageUrls.map((url, index) => `
        <div class="dish-carousel-item">
          <img src="${url}" alt="${dishData.dishName} ${index + 1}" onerror="this.parentElement.style.display='none'">
        </div>
      `).join('');

      const indicatorsHtml = dishData.imageUrls.map((_, index) => `
        <span class="dish-carousel-indicator ${index === 0 ? 'active' : ''}" data-index="${index}"></span>
      `).join('');

      carouselHtml = `
        <div class="dish-image-container">
          <div class="dish-carousel" id="popupDishCarousel">
            <div class="dish-carousel-inner" id="popupCarouselInner">
              ${carouselItemsHtml}
            </div>
            ${dishData.imageUrls.length > 1 ? `
              <button class="dish-carousel-control prev" id="popupCarouselPrev">‹</button>
              <button class="dish-carousel-control next" id="popupCarouselNext">›</button>
              <div class="dish-carousel-indicators" id="popupCarouselIndicators">
                ${indicatorsHtml}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } else {
      carouselHtml = `
        <div class="dish-image-container">
          <div class="dish-image-placeholder">暂无图片</div>
        </div>
      `;
    }

    sidebar.innerHTML = `
      <div class="sidebar-header">
        <h3>${dishData.dishName}</h3>
        <button class="sidebar-close" id="close-dish-sidebar">×</button>
      </div>
      <div class="sidebar-content">
        ${carouselHtml}

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

    // 初始化轮播图
    if (hasImages && dishData.imageUrls.length > 1) {
      initPopupCarousel();
    }
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

  // 前往设置按钮（配置错误时显示）
  const goToSettingsBtn = document.getElementById('goToSettings');
  if (goToSettingsBtn) {
    goToSettingsBtn.onclick = () => {
      // 切换到设置标签页
      const settingsBtn = document.getElementById('tab-settings');
      if (settingsBtn) {
        settingsBtn.click();
      }
      // 关闭侧边栏
      closeDishSidebar();
    };
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
 * GitLab 日期范围切换
 */
async function onGitLabDateRangeChange() {
  const dateRange = elements.gitlabDateRange.value;
  console.log('GitLab 日期范围切换:', dateRange);

  // 更新配置
  if (currentConfig && currentConfig.gitlab) {
    currentConfig.gitlab.dateRange = dateRange;

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

// ===== 禅道相关函数 =====

/**
 * 展开/收起禅道列表
 * @param {string} type - 类型: 'tasks' | 'bugs'
 */
function toggleZentaoList(type) {
  console.log('[Popup] toggleZentaoList 被调用，type:', type);

  const btnMap = {
    tasks: elements.toggleTasksBtn,
    bugs: elements.toggleBugsBtn
  };

  const listMap = {
    tasks: elements.zentaoTasksList,
    bugs: elements.zentaoBugsList
  };

  const btn = btnMap[type];
  const list = listMap[type];

  console.log('[Popup] btn:', btn);
  console.log('[Popup] list:', list);

  if (!btn || !list) return;

  const isExpanded = list.classList.contains('expanded');
  console.log('[Popup] 当前展开状态:', isExpanded);

  if (isExpanded) {
    // 收起
    list.classList.remove('expanded');
    btn.classList.remove('active');
    btn.textContent = '展开 ▼';
    console.log('[Popup] 已收起');
  } else {
    // 展开
    list.classList.add('expanded');
    list.style.display = 'block'; // 移除 inline style 的 display: none
    btn.classList.add('active');
    btn.textContent = '收起 ▲';
    console.log('[Popup] 已展开，list.classList:', list.classList);
  }
}

/**
 * 渲染禅道数据
 * @param {Object} zentaoData - 禅道数据
 *
 * 数据结构示例：
 * {
 *   tasks: [
 *     {
 *       id: 123,
 *       name: "实现用户登录功能",
 *       status: "doing",  // wait | doing | done
 *       priority: 3,      // 1=最高, 2=高, 3=中, 4=低
 *       assignedTo: "张三",
 *       url: "http://zentao.com/task-view-123.html"
 *     }
 *   ],
 *   bugs: [
 *     {
 *       id: 456,
 *       title: "登录页面样式错乱",
 *       status: "active",  // active | resolved | closed
 *       severity: 2,       // 1-4
 *       assignedTo: "李四",
 *       url: "http://zentao.com/bug-view-456.html"
 *     }
 *   ],
 *   stories: [
 *     {
 *       id: 789,
 *       title: "用户个人中心需求",
 *       status: "active",  // draft | active | closed
 *       stage: "reviewing", // 评审中
 *       assignedTo: "王五",
 *       url: "http://zentao.com/story-view-789.html"
 *     }
 *   ]
 * }
 */
function renderZentaoData(zentaoData) {
  if (!zentaoData) return;

  // 渲染任务
  if (zentaoData.tasks) {
    renderZentaoTasks(zentaoData.tasks);
  }

  // 渲染 Bug
  if (zentaoData.bugs) {
    renderZentaoBugs(zentaoData.bugs);
  }
}

/**
 * 渲染禅道任务列表
 */
function renderZentaoTasks(tasks) {
  const count = tasks.length;
  const countElem = document.getElementById('zentaoTasksCount');
  const toggleBtn = elements.toggleTasksBtn;
  const listElem = elements.zentaoTasksList;
  const estimateElem = document.getElementById('zentaoTasksEstimate');
  const estimateValueElem = document.getElementById('zentaoTasksEstimateValue');

  console.log('[Popup] renderZentaoTasks 被调用，任务数量:', count);

  if (countElem) {
    countElem.textContent = count;
  }

  if (count === 0) {
    if (toggleBtn) toggleBtn.style.display = 'none';
    if (estimateElem) estimateElem.style.display = 'none';
    listElem.innerHTML = '<div class="zentao-empty">暂无待处理任务</div>';
    return;
  }

  // 计算预计工时总和
  const totalEstimate = tasks.reduce((sum, task) => sum + (task.estimate || 0), 0);
  console.log('[Popup] 预计工时总和:', totalEstimate);

  // 显示预计工时
  if (estimateElem && estimateValueElem) {
    estimateElem.style.display = 'flex';
    estimateValueElem.textContent = `${totalEstimate.toFixed(1)} 小时`;
  }

  // 显示展开按钮
  if (toggleBtn) toggleBtn.style.display = 'block';

  // 渲染任务列表
  let html = '';
  tasks.forEach(task => {
    // 状态映射：只区分完成和未完成
    const statusInfo = task.status === '已完成'
      ? { class: 'task-completed', text: '完成' }
      : { class: 'task-pending', text: '未完成' };

    html += `
      <div class="zentao-item">
        <div class="zentao-content">
          <div class="zentao-title">
            ${task.url ? `<a href="${task.url}" target="_blank">${task.name}</a>` : task.name}
          </div>
          <div class="zentao-meta">
            <span class="zentao-status ${statusInfo.class}">${statusInfo.text}</span>
          </div>
        </div>
      </div>
    `;
  });

  console.log('[Popup] 生成的任务 HTML 长度:', html.length);

  listElem.innerHTML = html;
  console.log('[Popup] innerHTML 已设置，listElem.children.length:', listElem.children.length);
}

/**
 * 渲染禅道 Bug 列表
 */
function renderZentaoBugs(bugs) {
  const count = bugs.length;
  const countElem = document.getElementById('zentaoBugsCount');
  const toggleBtn = elements.toggleBugsBtn;
  const listElem = elements.zentaoBugsList;

  console.log('[Popup] renderZentaoBugs 被调用，Bug 数量:', count);
  console.log('[Popup] listElem:', listElem);

  if (countElem) {
    countElem.textContent = count;
  }

  if (count === 0) {
    if (toggleBtn) toggleBtn.style.display = 'none';
    listElem.innerHTML = '<div class="zentao-empty">暂无待修复 Bug</div>';
    return;
  }

  // 显示展开按钮
  if (toggleBtn) toggleBtn.style.display = 'block';

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
      <div class="zentao-item">
        <div class="zentao-content">
          <div class="zentao-title">
            ${bug.url ? `<a href="${bug.url}" target="_blank">${bug.title}</a>` : bug.title}
          </div>
          <div class="zentao-meta">
            <span class="zentao-status ${statusInfo.class}">${statusInfo.text}</span>
          </div>
        </div>
      </div>
    `;
  });

  console.log('[Popup] 生成的 HTML 长度:', html.length);
  console.log('[Popup] HTML 前500字符:', html.substring(0, 500));

  listElem.innerHTML = html;
  console.log('[Popup] innerHTML 已设置，listElem.children.length:', listElem.children.length);
}

/**
 * 生成 Bug AI 总结
 */
async function generateBugSummary() {
  console.log('[Popup] 开始生成 Bug 总结...');

  // 隐藏之前的结果和错误
  elements.bugSummaryResult.style.display = 'none';
  elements.bugSummaryError.style.display = 'none';

  // 显示加载状态
  elements.bugSummaryLoading.style.display = 'block';
  elements.generateBugSummaryBtn.disabled = true;

  try {
    const response = await sendMessage({ action: 'generateBugSummary' });

    if (response.success) {
      // 显示总结结果
      elements.bugSummaryContent.textContent = response.summary;
      elements.bugSummaryResult.style.display = 'block';
      console.log('[Popup] Bug 总结生成成功:', response.summary);
    } else {
      // 显示错误
      elements.bugSummaryError.textContent = response.error || '生成失败';
      elements.bugSummaryError.style.display = 'block';
    }
  } catch (error) {
    console.error('[Popup] 生成 Bug 总结失败:', error);
    elements.bugSummaryError.textContent = '生成失败: ' + error.message;
    elements.bugSummaryError.style.display = 'block';
  } finally {
    // 隐藏加载状态
    elements.bugSummaryLoading.style.display = 'none';
    elements.generateBugSummaryBtn.disabled = false;
  }
}

// ===== 轮播图功能（Popup 侧边栏） =====
let popupCurrentSlide = 0;
let popupTotalSlides = 0;

function initPopupCarousel() {
  const carousel = document.getElementById('popupDishCarousel');
  if (!carousel) return;

  const inner = document.getElementById('popupCarouselInner');
  const prevBtn = document.getElementById('popupCarouselPrev');
  const nextBtn = document.getElementById('popupCarouselNext');
  const indicators = document.querySelectorAll('#popupCarouselIndicators .dish-carousel-indicator');

  if (!inner) return;

  popupTotalSlides = inner.children.length;
  popupCurrentSlide = 0;

  // 绑定上一张按钮
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      popupCurrentSlide = (popupCurrentSlide - 1 + popupTotalSlides) % popupTotalSlides;
      updatePopupCarousel();
    });
  }

  // 绑定下一张按钮
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      popupCurrentSlide = (popupCurrentSlide + 1) % popupTotalSlides;
      updatePopupCarousel();
    });
  }

  // 绑定指示器点击
  indicators.forEach((indicator, index) => {
    indicator.addEventListener('click', () => {
      popupCurrentSlide = index;
      updatePopupCarousel();
    });
  });

  // 初始化显示
  updatePopupCarousel();
}

function updatePopupCarousel() {
  const inner = document.getElementById('popupCarouselInner');
  const indicators = document.querySelectorAll('#popupCarouselIndicators .dish-carousel-indicator');

  if (!inner) return;

  // 更新轮播位置
  inner.style.transform = `translateX(-${popupCurrentSlide * 100}%)`;

  // 更新指示器状态
  indicators.forEach((indicator, index) => {
    if (index === popupCurrentSlide) {
      indicator.classList.add('active');
    } else {
      indicator.classList.remove('active');
    }
  });
}

console.log('Popup 脚本加载完成');
