/**
 * 工作流聚合助手 - 后台服务脚本
 * 负责定时获取各系统数据并缓存
 */

// 系统配置（后续可以通过设置页面配置）
const SYSTEMS = {
  oa: {
    name: 'OA系统',
    baseURL: 'http://oa.lets.com/web/home/index',  // OA 系统地址
    apiURL: 'http://oa.lets.com',  // OA API 基础地址
    enabled: false,
    dateRange: 'today'  // 默认查询今天：today, week, month
  },
  zentao: {
    name: '禅道',
    baseURL: 'http://120.42.34.82:9888',
    enabled: true
  },
  gitlab: {
    name: 'GitLab',
    baseURL: 'http://gitlab.lets.com:8800',
    enabled: true
  },
  zhipu: {
    name: '智谱AI',
    provider: 'zhipu',  // AI 服务商：zhipu/aliyun/openai
    apiKey: '',  // 待配置
    enabled: false
  }
};

// 扩展安装时触发
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('工作流聚合助手已安装/更新', details.reason);

  // 获取现有配置
  const result = await chrome.storage.local.get(['systems']);

  if (!result.systems || details.reason === 'install') {
    // 首次安装或没有配置时，使用默认配置
    console.log('初始化默认配置');
    chrome.storage.local.set({
      systems: SYSTEMS,
      lastUpdate: null,
      data: {}
    });
  } else {
    // 更新或重新加载时，保留用户配置
    console.log('保留现有配置:', result.systems);
    // 智能合并：只覆盖非空的用户配置，空值使用默认值
    const mergedSystems = {};
    Object.keys(SYSTEMS).forEach(key => {
      const defaultConfig = SYSTEMS[key];
      const userConfig = result.systems[key] || {};

      // 合并配置，但跳过用户配置中的空值
      mergedSystems[key] = { ...defaultConfig };
      Object.keys(userConfig).forEach(prop => {
        // 只有用户配置的值不为空时才覆盖默认值
        if (userConfig[prop] !== '' && userConfig[prop] !== null && userConfig[prop] !== undefined) {
          mergedSystems[key][prop] = userConfig[prop];
        }
      });
    });
    chrome.storage.local.set({ systems: mergedSystems });
    console.log('配置已合并:', mergedSystems);
  }

  // 设置每小时检查一次的定时器
  chrome.alarms.create('checkOALog', {
    periodInMinutes: 60  // 每小时检查一次
  });
  console.log('已设置 OA 日志检查定时器');
});

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('收到消息:', request);

  if (request.action === 'refreshData') {
    refreshAllData().then(data => {
      sendResponse({ success: true, data });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // 异步响应
  }

  if (request.action === 'getConfig') {
    chrome.storage.local.get(['systems'], (result) => {
      sendResponse({ success: true, systems: result.systems });
    });
    return true;
  }

  if (request.action === 'saveConfig') {
    chrome.storage.local.set({ systems: request.systems }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'generateSummary') {
    generateAISummary().then(summary => {
      sendResponse({ success: true, summary });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // 异步响应
  }

  if (request.action === 'getDishDetail') {
    getDishDetail(request.dishName, request.mealType).then(data => {
      sendResponse({ success: true, data });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // 异步响应
  }
});

/**
 * 刷新所有系统的数据
 */
async function refreshAllData() {
  console.log('开始刷新所有系统数据...');

  try {
    const { systems } = await chrome.storage.local.get(['systems']);
    const results = {};
    const errors = [];
    let oaLoginError = null;

    // 并行获取各系统数据
    const promises = Object.entries(systems).map(async ([key, system]) => {
      if (!system.enabled || !system.baseURL) {
        results[key] = null;
        return;
      }

      try {
        const data = await fetchSystemData(key, system);
        results[key] = data;
      } catch (error) {
        console.error(`获取${system.name}数据失败:`, error);

        // 特殊处理 OA 登录错误
        if (key === 'oa' && error.needLogin) {
          oaLoginError = {
            message: error.message,
            loginUrl: error.loginUrl
          };
          console.log('捕获到 OA 登录错误，保存到 storage:', oaLoginError);
        } else {
          errors.push({
            system: system.name,
            error: error.message
          });
        }

        results[key] = null;
      }
    });

    await Promise.all(promises);

    // 保存到存储
    await chrome.storage.local.set({
      data: results,
      lastUpdate: new Date().toISOString(),
      errors: errors,
      oaLoginError: oaLoginError
    });

    // 更新徽章
    updateBadge(results);

    console.log('数据刷新完成:', results);
    return results;

  } catch (error) {
    console.error('刷新数据失败:', error);
    throw error;
  }
}

/**
 * 获取单个系统的数据
 */
async function fetchSystemData(systemKey, systemConfig) {
  console.log(`正在获取 ${systemConfig.name} 的数据...`);

  // 根据不同系统调用对应的 API
  switch (systemKey) {
    case 'zentao':
      return await fetchZentaoData(systemConfig);
    case 'oa':
      return await fetchOAData(systemConfig);
    case 'gitlab':
      return await fetchGitLabData(systemConfig);
    default:
      return null;
  }
}

/**
 * 获取禅道数据
 */
async function fetchZentaoData(config) {
  try {
    const url = `${config.baseURL}/index.php?m=block&f=printBlock&id=753&module=my`;
    console.log('请求禅道 URL:', url);

    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    console.log('禅道返回数据长度:', html.length);

    // 解析 HTML 提取数据
    const data = parseZentaoHTML(html);
    return data;

  } catch (error) {
    console.error('获取禅道数据失败:', error);
    throw error;
  }
}

/**
 * 解析禅道 HTML 数据
 */
function parseZentaoHTML(html) {
  const data = {
    tasks: 0,
    bugs: 0,
    stories: 0,
    tasksList: [],
    bugsList: [],
    storiesList: []
  };

  try {
    // 移除所有HTML标签和多余空格，便于匹配
    const cleanText = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    console.log('清理后的文本片段:', cleanText.substring(0, 500));

    // 使用正则表达式提取数据
    // 任务数量 - 匹配 "我的任务" 后面的数字
    const taskMatch = cleanText.match(/我的任务\s+(\d+)/);
    if (taskMatch) {
      data.tasks = parseInt(taskMatch[1]) || 0;
    }

    // Bug 数量 - 匹配 "我的BUG" 后面的数字
    const bugMatch = cleanText.match(/我的BUG\s+(\d+)/);
    if (bugMatch) {
      data.bugs = parseInt(bugMatch[1]) || 0;
    }

    // 需求数量 - 匹配 "我的研发需求" 后面的数字
    const storyMatch = cleanText.match(/我的研发需求\s+(\d+)/);
    if (storyMatch) {
      data.stories = parseInt(storyMatch[1]) || 0;
    }

    console.log('解析禅道数据:', data);

  } catch (error) {
    console.error('解析禅道数据失败:', error);
  }

  return data;
}

/**
 * 获取 OA 数据
 * @see docs/oa-integration.md OA 集成文档
 * @see CLAUDE.md 项目规范
 */
async function fetchOAData(config) {
  const apiURL = config.apiURL || 'http://oa.lets.com';
  const dateRange = config.dateRange || 'today';

  let logData = null;
  let canteenData = null;

  // 先获取工作日志（如果失败且是登录错误，直接抛出）
  try {
    logData = await fetchOAWorkLog(apiURL, dateRange);
  } catch (error) {
    // 如果是登录错误，直接抛出，不再尝试获取食堂菜单
    if (error.needLogin) {
      console.log('检测到 OA 登录错误，中断数据获取');
      throw error;
    }
    console.error('获取 OA 工作日志失败（非登录错误）:', error);
    // 非登录错误，继续尝试获取食堂菜单
  }

  // 尝试获取食堂菜单
  try {
    canteenData = await fetchOACanteenMenu(apiURL);
  } catch (error) {
    console.error('获取 OA 食堂菜单失败:', error);
    // 食堂菜单失败不影响整体
  }

  // 如果两个都失败了，抛出错误
  if (!logData && !canteenData) {
    throw new Error('无法获取 OA 数据');
  }

  // 合并数据
  return {
    ...logData,
    canteen: canteenData
  };
}

/**
 * 获取 OA 工作日志
 */
async function fetchOAWorkLog(apiURL, dateRange) {
  try {
    // 获取日期范围
    const { start, end } = getDateRange(dateRange);

    // 构建请求 URL
    const url = `${apiURL}/api/my/workjournal/list`;
    console.log('请求 OA 工作日志 URL:', url);
    console.log('日期范围:', { start, end, dateRange });

    const params = new URLSearchParams({
      start: start,
      end: end,
      log_type: '1',
      type: '0'
    });

    const response = await fetch(`${url}?${params}`, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    console.log('OA 工作日志返回数据:', json);

    // 检查是否需要登录
    if (json.code === 1024) {
      const loginError = new Error(json.msg || '请重新登录');
      loginError.needLogin = true;
      loginError.loginUrl = `${apiURL}/web/home/index`;
      throw loginError;
    }

    // 检查其他错误
    if (json.code !== 200) {
      throw new Error(json.msg || 'OA 接口返回错误');
    }

    // 解析数据
    return parseOAData(json, dateRange);

  } catch (error) {
    console.error('获取 OA 工作日志失败:', error);
    throw error;
  }
}

/**
 * 获取 OA 食堂菜单（本周）
 * @see docs/oa-canteen.md OA 食堂菜单文档
 * @see CLAUDE.md 项目规范
 */
async function fetchOACanteenMenu(apiURL) {
  try {
    const url = `${apiURL}/web/oa/canteen/ordermenulist`;
    console.log('请求 OA 食堂菜单 URL:', url);

    // 使用 POST 请求
    const formData = new URLSearchParams({
      room_id: '19',
      order_type: '0'
    });

    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html'
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    console.log('OA 食堂菜单返回数据长度:', html.length);

    // 解析 HTML
    return parseOACanteenHTML(html);

  } catch (error) {
    console.error('获取 OA 食堂菜单失败:', error);
    throw error;
  }
}

/**
 * 解析 OA 数据
 */
function parseOAData(json, dateRange) {
  const data = {
    dateRange: dateRange,
    hasLog: false,
    logCount: 0,
    logs: []
  };

  try {
    if (json.code === 200 && Array.isArray(json.data)) {
      data.logCount = json.data.length;
      data.hasLog = json.data.length > 0;

      // 保存日志详情
      data.logs = json.data.map(log => ({
        id: log.id,
        title: log.title || log.org_title,
        starttime: log.starttime,
        endtime: log.endtime,
        type: log.type,
        logType: log.log_type
      }));

      console.log('解析 OA 数据:', data);
    }
  } catch (error) {
    console.error('解析 OA 数据失败:', error);
  }

  return data;
}

/**
 * 解析 OA 食堂菜单 HTML
 * @param {string} html - HTML 内容
 * @returns {object} 解析后的菜单数据
 */
function parseOACanteenHTML(html) {
  const data = {
    weekMenu: []  // 本周菜单
  };

  try {
    // 提取所有 <tr class="order"> 的内容
    const orderRowRegex = /<tr\s+class="order">([\s\S]*?)<\/tr>/g;
    const orderRows = html.matchAll(orderRowRegex);

    for (const row of orderRows) {
      const rowContent = row[1];

      // 提取日期和星期（第一个 td）
      const dateMatch = rowContent.match(/<td[^>]*>([^<]+)\(([^)]+)\)<\/td>/);
      if (!dateMatch) continue;

      const dateStr = dateMatch[1].trim();  // 如 "2026-01-09"
      const weekday = dateMatch[2];          // 如 "周五"

      // 提取所有餐别的菜单
      const mealData = {
        date: dateStr,
        weekday: weekday,
        meals: {}  // { breakfast: [...], lunch: [...], dinner: [...] }
      };

      // 提取第二个 td 的内容
      const tdContentMatch = rowContent.match(/<td>([\s\S]*?)<\/td>\s*$/);
      if (!tdContentMatch) continue;

      const tdContent = tdContentMatch[1];

      // 解析早餐
      const breakfastMeals = extractMeals(tdContent, '早餐');
      if (breakfastMeals.length > 0) {
        mealData.meals.breakfast = breakfastMeals;
      }

      // 解析午餐
      const lunchMeals = extractMeals(tdContent, '午餐');
      if (lunchMeals.length > 0) {
        mealData.meals.lunch = lunchMeals;
      }

      // 解析晚餐
      const dinnerMeals = extractMeals(tdContent, '晚餐');
      if (dinnerMeals.length > 0) {
        mealData.meals.dinner = dinnerMeals;
      }

      // 使用阈值判断是否为本周数据
      // 统计所有餐别中有具体菜名的菜品比例
      let totalMeals = 0;
      let mealsWithDish = 0;

      Object.values(mealData.meals).forEach(mealArray => {
        mealArray.forEach(meal => {
          totalMeals++;
          if (meal.dish) {
            mealsWithDish++;
          }
        });
      });

      // 如果有餐别数据，且至少50%的菜品有具体菜名，则认为是本周数据
      const hasAnyMeal = totalMeals > 0;
      const dishRatio = totalMeals > 0 ? mealsWithDish / totalMeals : 0;
      const isCurrentWeek = dishRatio >= 0.5;

      console.log(`日期 ${mealData.date} ${mealData.weekday} - 总菜品:${totalMeals}, 有菜名:${mealsWithDish}, 比例:${(dishRatio * 100).toFixed(1)}%, 是否本周:${isCurrentWeek}`);

      if (hasAnyMeal && isCurrentWeek) {
        data.weekMenu.push(mealData);
      }
    }

    console.log('解析食堂菜单数据（阈值筛选），共', data.weekMenu.length, '天:', data);

  } catch (error) {
    console.error('解析食堂菜单 HTML 失败:', error);
  }

  return data;
}

/**
 * 提取特定餐别的菜单
 * @param {string} content - HTML 内容
 * @param {string} mealType - 餐别类型：早餐、午餐、晚餐
 * @returns {array} 菜单列表
 */
function extractMeals(content, mealType) {
  const meals = [];

  try {
    // 先尝试找到餐别标记的位置
    const markerPattern = `<span style="color: red;">\\*&nbsp;<\\/span>${mealType}：`;
    const markerRegex = new RegExp(markerPattern);

    if (!markerRegex.test(content)) {
      console.log(`未找到 ${mealType} 标记`);
      return meals;
    }

    // 找到当前餐别的起始位置
    const markerIndex = content.search(markerRegex);
    console.log(`找到 ${mealType} 标记位置: ${markerIndex}`);

    // 从标记位置开始截取内容
    const fromMarker = content.substring(markerIndex);

    // 找到下一个餐别标记的位置（查找下一个 *&nbsp;</span>）
    const nextMealPattern = /<span style="color: red;">\*&nbsp;<\/span>(早餐|午餐|晚餐)：/;
    const nextMealMatch = fromMarker.substring(markerPattern.length).match(nextMealPattern);

    let mealContent;
    if (nextMealMatch) {
      // 如果找到下一个餐别，截取到下一个餐别之前
      const nextMealIndex = fromMarker.substring(markerPattern.length).search(nextMealPattern);
      mealContent = fromMarker.substring(0, markerPattern.length + nextMealIndex);
      console.log(`${mealType} 内容长度: ${mealContent.length} (截取到下一个餐别)`);
    } else {
      // 如果没有下一个餐别，截取到 </td>
      const endIndex = fromMarker.indexOf('</td>');
      if (endIndex !== -1) {
        mealContent = fromMarker.substring(0, endIndex);
        console.log(`${mealType} 内容长度: ${mealContent.length} (截取到</td>)`);
      } else {
        mealContent = fromMarker;
        console.log(`${mealType} 内容长度: ${mealContent.length} (截取到结尾)`);
      }
    }

    // 提取所有 label 标签中的菜名
    const labelRegex = /<label\s+class="form-check-label"[^>]*>(.*?)<\/label>/g;
    const labels = mealContent.matchAll(labelRegex);

    for (const label of labels) {
      const labelText = label[1].trim();

      // 解析菜名，格式如：早餐A（6元）(地瓜粥) 或 早餐A（6元）
      // 使用正则提取套餐名称和菜品名称
      const mealPattern = /^([^(（]+)（([^)）]+)）(?:\(([^)]+)\))?/;
      const mealMatch = labelText.match(mealPattern);

      if (mealMatch) {
        const mealName = mealMatch[1].trim();  // 如 "早餐A"
        const price = mealMatch[2].trim();     // 如 "6元"
        const dish = mealMatch[3] ? mealMatch[3].trim() : null;  // 如 "地瓜粥" 或 null

        meals.push({
          mealName: mealName,
          price: price,
          dish: dish,
          fullName: dish ? `${mealName}（${price}）(${dish})` : `${mealName}（${price}）`
        });
      }
    }

  } catch (error) {
    console.error(`提取 ${mealType} 失败:`, error);
  }

  return meals;
}

/**
 * 格式化日期为 YYYY-MM-DD 格式
 * @param {Date} date - 日期对象
 * @returns {string} 格式化的日期字符串
 */
function formatDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取日期范围
 * @param {string} range - 日期范围类型：today, week, month
 * @returns {object} { start, end } - 格式化的日期字符串
 */
function getDateRange(range) {
  const now = new Date();
  let start, end;

  switch (range) {
    case 'today':
      // 今天 00:00:00 到明天 00:00:00
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(start);
      end.setDate(end.getDate() + 1);
      break;

    case 'week':
      // 本周一 00:00:00 到下周一 00:00:00
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 周日特殊处理
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
      end = new Date(start);
      end.setDate(end.getDate() + 7);
      break;

    case 'month':
      // 本月1号 00:00:00 到下月1号 00:00:00
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;

    default:
      // 默认今天
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(start);
      end.setDate(end.getDate() + 1);
  }

  // 格式化为 YYYY-MM-DD HH:mm:ss
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  return {
    start: formatDate(start),
    end: formatDate(end)
  };
}

/**
 * 获取 GitLab 数据
 */
async function fetchGitLabData(config) {
  try {
    // 固定用户名
    const username = 'jinglihao';
    const url = `${config.baseURL}/users/${username}/activity?limit=15`;
    console.log('请求 GitLab URL:', url);

    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    console.log('GitLab 返回数据，count:', json.count);

    // 解析 HTML 提取数据
    const data = parseGitLabHTML(json.html);
    return data;

  } catch (error) {
    console.error('获取 GitLab 数据失败:', error);
    throw error;
  }
}

/**
 * 解析 GitLab HTML 数据
 */
function parseGitLabHTML(html) {
  const data = {
    todayCommits: 0,
    todayCommitMessages: []  // 保存今日提交消息
  };

  try {
    // 获取今天的日期字符串
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    console.log('今天日期:', todayStr);

    // 提取所有包含 event-item 的 li 标签（完整的 li，包括嵌套的 li）
    const eventItemRegex = /<li class="event-item[^"]*"[^>]*>([\s\S]*?)(?=<li class="event-item|$)/g;
    const eventMatches = html.matchAll(eventItemRegex);

    for (const match of eventMatches) {
      const eventContent = match[1];

      // 检查是否包含 "pushed to branch" 或 "pushed new"
      if (eventContent.includes('pushed to branch') || eventContent.includes('pushed new')) {
        // 提取时间信息
        const timeMatch = eventContent.match(/<time[^>]*datetime="([^"]+)"/i);

        if (timeMatch) {
          const datetime = timeMatch[1];
          const activityDate = datetime.split('T')[0]; // 提取日期部分

          console.log('找到推送活动，时间:', datetime, '日期:', activityDate);

          // 判断是否是今天
          if (activityDate === todayStr) {
            data.todayCommits++;

            // 提取提交消息
            const commitMessages = extractCommitMessages(eventContent);
            data.todayCommitMessages.push(...commitMessages);
          }
        }
      }
    }

    console.log('解析 GitLab 数据:', data);

  } catch (error) {
    console.error('解析 GitLab 数据失败:', error);
  }

  return data;
}

/**
 * 从事件内容中提取提交消息
 */
function extractCommitMessages(eventContent) {
  const messages = [];

  try {
    // 提取所有 commit-row-title 中的内容
    const commitTitleRegex = /<div class="commit-row-title">([\s\S]*?)<\/div>/g;
    const titleMatches = eventContent.matchAll(commitTitleRegex);

    for (const match of titleMatches) {
      const titleContent = match[1];

      // 移除 HTML 标签
      let cleanText = titleContent.replace(/<[^>]*>/g, '');

      // 移除 &middot; 和多余空格
      cleanText = cleanText.replace(/&middot;/g, '').trim();

      // 提取 commit message（跳过 commit hash）
      const parts = cleanText.split(/\s+/);
      if (parts.length > 1) {
        // 第一个是 commit hash，后面是消息
        const message = parts.slice(1).join(' ').trim();
        if (message) {
          messages.push(message);
        }
      }
    }
  } catch (error) {
    console.error('提取提交消息失败:', error);
  }

  return messages;
}

/**
 * 更新扩展图标徽章
 */
function updateBadge(data) {
  // 只统计 BUG 数量
  let totalCount = 0;

  // 统计禅道 BUG
  if (data.zentao && !data.zentao.mock) {
    totalCount += (data.zentao.bugs || 0);
  }

  // TODO: 统计其他系统的 BUG 数据
  // if (data.oa?.bugs) totalCount += data.oa.bugs;

  if (totalCount > 0) {
    chrome.action.setBadgeText({ text: String(totalCount) });
    chrome.action.setBadgeBackgroundColor({ color: '#FF4757' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

/**
 * 统一的 HTTP 请求方法
 */
async function authenticatedFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',  // 自动携带 Cookie
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('认证失败，请重新登录');
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * 生成 AI 工作总结
 */
async function generateAISummary() {
  console.log('开始生成 AI 工作总结...');

  try {
    // 获取配置和数据
    const result = await chrome.storage.local.get(['systems', 'data']);
    const { systems, data } = result;

    // 检查 API Key
    if (!systems?.zhipu?.apiKey) {
      throw new Error('请先在设置中配置 AI API Key');
    }

    // 检查 provider
    const provider = systems.zhipu.provider || 'zhipu';
    console.log('当前 AI 服务商:', provider);

    // 检查今日提交数据
    if (!data?.gitlab?.todayCommitMessages || data.gitlab.todayCommitMessages.length === 0) {
      throw new Error('今日暂无提交记录');
    }

    const commitMessages = data.gitlab.todayCommitMessages;
    console.log('提交消息:', commitMessages);

    // 构建 prompt
    const prompt = `你是一位专业的技术总结助手。根据以下今日的 Git 提交记录，生成一份简洁的工作总结：

提交记录：
${commitMessages.map((msg, i) => `${i + 1}. ${msg}`).join('\n')}

请用中文总结今天完成的工作，要求：
1. 分析提交记录，归纳主要工作内容
2. 按功能模块分类（如果有多个模块）
3. 使用简洁的列表形式
4. 突出重点功能和改进

格式示例：
• 功能开发：...
• Bug 修复：...
• 优化改进：...`;

    // 调用对应的 AI API
    let summary;

    switch (provider) {
      case 'zhipu':
        summary = await callZhipuAPI(systems.zhipu.apiKey, prompt);
        break;
      case 'aliyun':
        summary = await callAliyunAPI(systems.zhipu.apiKey, prompt);
        break;
      case 'openai':
        summary = await callOpenAIAPI(systems.zhipu.apiKey, prompt);
        break;
      case 'relay':
        summary = await callRelayAPI(systems.zhipu.apiKey, prompt);
        break;
      default:
        throw new Error('不支持的 AI 服务商');
    }

    console.log('生成的总结:', summary);
    return summary;

  } catch (error) {
    console.error('生成 AI 总结失败:', error);
    throw error;
  }
}

/**
 * 调用智谱 API
 */
/**
 * 调用智谱 AI API
 * @param {string} apiKey - API密钥
 * @param {string} prompt - 用户提示
 * @param {boolean} enableWebSearch - 是否启用联网搜索（默认false）
 * @param {number} maxTokens - 最大token数（默认500）
 * @param {string} systemPrompt - 系统提示（可选）
 * @returns {Promise<string>} AI响应内容
 * @see docs/canteen/ai-integration.md AI集成文档
 * @see CLAUDE.md 项目规范
 */
async function callZhipuAPI(apiKey, prompt, maxTokens = 500, systemPrompt = '你是一位专业的技术总结助手，擅长分析代码提交记录并生成简洁明了的工作总结。') {
  const url = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

  const requestBody = {
    model: 'glm-4-flash',  // 使用免费的 glm-4-flash 模型
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: maxTokens
  };

  console.log('调用智谱 API (glm-4-flash)');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('智谱 API 错误响应:', errorText);
    throw new Error(`智谱 API 调用失败: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  if (!result.choices || result.choices.length === 0) {
    throw new Error('智谱 API 返回数据格式错误');
  }

  return result.choices[0].message.content;
}

/**
 * 获取当前周的缓存键
 * @returns {string} 格式："dishDetailsCache_2026-W02"
 * @see docs/canteen/cache-strategy.md 缓存策略文档
 * @see CLAUDE.md 项目规范
 */
function getCacheKey() {
  const now = new Date();
  const year = now.getFullYear();

  // 计算周数（ISO 8601标准）
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);

  return `dishDetailsCache_${year}-W${String(weekNumber).padStart(2, '0')}`;
}

/**
 * 从 AI 响应中提取 JSON 数据（支持多种格式容错）
 * @param {string} aiResponse - AI返回的原始文本
 * @returns {Object|null} 解析后的对象或null
 * @see docs/canteen/data-validation.md 数据验证文档
 * @see CLAUDE.md 项目规范
 */
function extractJSONFromResponse(aiResponse) {
  try {
    // 方案1：直接解析（最理想）
    return JSON.parse(aiResponse);
  } catch (e1) {
    try {
      // 方案2：提取 ```json ``` 代码块
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
    } catch (e2) {
      try {
        // 方案3：提取 { } 包裹的内容
        const objectMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          return JSON.parse(objectMatch[0]);
        }
      } catch (e3) {
        console.error('JSON 解析失败:', e3);
      }
    }
  }
  return null;
}

/**
 * 验证菜品数据完整性
 * @param {Object} data - 待验证的数据对象
 * @returns {boolean} 是否有效
 * @see docs/canteen/data-validation.md 数据验证文档
 * @see CLAUDE.md 项目规范
 */
function validateDishData(data) {
  if (!data || typeof data !== 'object') return false;

  // 必需字段验证
  if (!data.dishName || typeof data.dishName !== 'string') return false;
  if (!data.intro || typeof data.intro !== 'string') return false;

  // 数组字段验证
  if (!Array.isArray(data.ingredients) || data.ingredients.length === 0) return false;
  if (!Array.isArray(data.cookingMethods) || data.cookingMethods.length === 0) return false;

  // imageUrl 可以为空字符串，但必须是字符串类型
  if (typeof data.imageUrl !== 'string') return false;

  return true;
}

/**
 * 生成菜品详情的 Prompt 模板
 * @param {string} dishName - 菜品名称
 * @param {string} mealType - 餐别（breakfast/lunch/dinner）
 * @returns {string} Prompt文本
 * @see docs/canteen/dish-analysis.md 菜品分析文档
 * @see CLAUDE.md 项目规范
 */
function generateDishAnalysisPrompt(dishName, mealType) {
  const mealTypeMap = {
    breakfast: '早餐',
    lunch: '午餐',
    dinner: '晚餐'
  };

  const mealContext = mealTypeMap[mealType] || '';

  return `请分析食堂${mealContext}菜品"${dishName}"。

**分析要求**：
1. **简短介绍**（30-50字）：
   - 描述菜品的口味特点（如酸甜、香辣、清淡等）
   - 提及主要营养价值（如高蛋白、富含维生素等）
   - 适合的人群或场景

2. **主要食材**（3-5个）：
   - 列出构成该菜品的关键食材
   - 按重要性排序

3. **做法关键词**（3-4个）：
   - 简要描述烹饪方法（如"红烧"、"清蒸"、"爆炒"、"油炸"等）
   - 关键工艺特点

4. **做法步骤**（3-5个步骤）：
   - 简要列出烹饪的主要步骤
   - 每个步骤8-15字，简洁明了
   - 例如："食材洗净切块" → "热油爆香葱姜" → "加调料翻炒" → "收汁出锅"

**输出格式**（严格 JSON，不要包含任何其他文字）：
\`\`\`json
{
  "dishName": "${dishName}",
  "intro": "这里是30-50字的简短介绍",
  "ingredients": ["食材1", "食材2", "食材3"],
  "cookingMethods": ["做法1", "做法2", "做法3"],
  "cookingSteps": ["步骤1", "步骤2", "步骤3", "步骤4"]
}
\`\`\`

**⚠️ 关键要求**：
- 仅返回 JSON 代码块，不要添加任何解释性文字
- 确保所有字段都存在，数组至少包含一个元素
- cookingSteps 每个步骤简短（8-15字）`;
}

/**
 * 使用 SerpAPI 搜索菜品图片
 * @param {string} dishName - 菜品名称
 * @param {string} apiKey - SerpAPI 的 API Key
 * @param {string} engine - 搜索引擎 ('google' 或 'bing')
 * @returns {Promise<string>} 图片URL，失败返回空字符串
 * @see docs/canteen/serpapi-integration.md SerpAPI集成文档
 * @see CLAUDE.md 项目规范
 */
async function searchDishImage(dishName, apiKey, engine = 'bing') {
  try {
    // 构建搜索查询
    const searchQuery = `${dishName} 菜肴 美食`;

    // 根据引擎选择不同的 endpoint
    const engineParam = engine === 'google' ? 'google_images' : 'bing_images';

    // SerpAPI 请求 URL
    const url = `https://serpapi.com/search?engine=${engineParam}&q=${encodeURIComponent(searchQuery)}&api_key=${apiKey}`;

    console.log(`🔍 使用 SerpAPI 搜索图片 (${engineParam}):`, searchQuery);

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SerpAPI 请求失败:', response.status, response.statusText);
      console.error('错误详情:', errorText);
      return '';
    }

    const data = await response.json();
    console.log('SerpAPI 响应:', data);

    // 解析图片结果
    let imageUrl = '';

    if (data.images_results && data.images_results.length > 0) {
      // Google 和 Bing 都使用相同的结构
      const firstImage = data.images_results[0];
      imageUrl = firstImage.original || firstImage.thumbnail || '';
    }

    if (imageUrl) {
      console.log('✅ 找到图片:', imageUrl);
    } else {
      console.warn('⚠️ 未找到图片结果');
      console.warn('响应数据结构:', JSON.stringify(data, null, 2));
    }

    return imageUrl;

  } catch (error) {
    console.error('SerpAPI 搜索图片失败:', error);
    return '';
  }
}

/**
 * 通过 AI 生成菜品详情（含图片搜索）
 * @param {string} dishName - 菜品名称
 * @param {string} mealType - 餐别类型
 * @returns {Promise<Object>} 菜品详情对象
 * @see docs/canteen/dish-analysis.md 菜品分析流程
 * @see CLAUDE.md 项目规范
 */
async function generateDishInfoWithImage(dishName, mealType) {
  try {
    // 1. 获取配置（AI + SerpAPI）
    const result = await chrome.storage.local.get(['systems', 'serpapi']);
    const systems = result.systems || {};
    const serpapi = result.serpapi || {};

    if (!systems.zhipu || !systems.zhipu.apiKey) {
      throw new Error('智谱AI未配置，请先在设置中配置 API Key');
    }

    // 2. 生成 Prompt（不含图片）
    const prompt = generateDishAnalysisPrompt(dishName, mealType);

    // 3. 调用 AI 生成菜品信息
    const systemPrompt = '你是一位专业的美食顾问，擅长分析菜品特点。';
    console.log('生成菜品信息:', dishName);

    const response = await callZhipuAPI(
      systems.zhipu.apiKey,
      prompt,
      500,  // maxTokens
      systemPrompt
    );

    // 4. 解析 JSON
    const dishData = extractJSONFromResponse(response);

    if (!dishData) {
      throw new Error('AI返回数据无法解析为JSON');
    }

    // 5. 验证数据
    if (!dishData.dishName || !dishData.intro ||
        !Array.isArray(dishData.ingredients) ||
        !Array.isArray(dishData.cookingMethods) ||
        !Array.isArray(dishData.cookingSteps)) {
      console.warn('AI返回数据格式不完整:', dishData);
      throw new Error('AI返回数据格式无效');
    }

    // 6. 使用 SerpAPI 搜索图片（如果已配置）
    let imageUrl = '';

    if (serpapi && serpapi.apiKey) {
      const engine = serpapi.engine || 'bing';  // 默认 Bing（国内访问稳定）
      console.log('使用 SerpAPI 搜索图片...');
      imageUrl = await searchDishImage(dishName, serpapi.apiKey, engine);
    } else {
      console.warn('⚠️ SerpAPI 未配置，跳过图片搜索');
    }

    // 7. 合并数据
    dishData.imageUrl = imageUrl;
    dishData.timestamp = Date.now();

    console.log('✅ 菜品详情生成完成:', dishData);
    return dishData;

  } catch (error) {
    console.error('生成菜品详情失败:', error);

    // 返回降级数据
    return {
      dishName,
      intro: '暂无介绍',
      ingredients: [],
      cookingMethods: [],
      cookingSteps: [],
      imageUrl: '',
      timestamp: Date.now(),
      error: error.message
    };
  }
}

/**
 * 获取菜品详情（带缓存）
 * @param {string} dishName - 菜品名称
 * @param {string} mealType - 餐别类型
 * @returns {Promise<Object>} 菜品详情对象
 * @see docs/canteen/dish-detail-flow.md 详情获取流程
 * @see CLAUDE.md 项目规范
 */
async function getDishDetail(dishName, mealType) {
  try {
    // 1. 获取缓存键
    const cacheKey = getCacheKey();
    console.log('当前缓存键:', cacheKey);

    // 2. 尝试读取缓存
    const storage = await chrome.storage.local.get([cacheKey]);
    const cache = storage[cacheKey] || {};

    // 3. 检查是否有该菜品的缓存
    if (cache[dishName]) {
      console.log('使用缓存数据:', dishName);
      return cache[dishName];
    }

    // 4. 缓存未命中，调用 AI 生成
    console.log('生成新数据:', dishName);
    const dishData = await generateDishInfoWithImage(dishName, mealType);

    // 5. 保存到缓存
    cache[dishName] = dishData;
    await chrome.storage.local.set({ [cacheKey]: cache });
    console.log('已保存到缓存');

    return dishData;

  } catch (error) {
    console.error('获取菜品详情失败:', error);
    throw error;
  }
}

/**
 * 调用阿里云通义千问 API
 */
async function callAliyunAPI(apiKey, prompt) {
  const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

  const requestBody = {
    model: 'qwen-turbo',  // 使用性价比高的 qwen-turbo
    input: {
      messages: [
        {
          role: 'system',
          content: '你是一位专业的技术总结助手，擅长分析代码提交记录并生成简洁明了的工作总结。'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    },
    parameters: {
      result_format: 'message'
    }
  };

  console.log('调用阿里云通义千问 API');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('阿里云 API 错误响应:', errorText);
    throw new Error(`阿里云 API 调用失败: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  console.log('阿里云 API 响应:', result);

  if (!result.output || !result.output.choices || result.output.choices.length === 0) {
    throw new Error('阿里云 API 返回数据格式错误');
  }

  return result.output.choices[0].message.content;
}

/**
 * 调用 OpenAI API
 */
async function callOpenAIAPI(apiKey, prompt) {
  const url = 'https://api.openai.com/v1/chat/completions';

  const requestBody = {
    model: 'gpt-3.5-turbo',  // 使用 gpt-3.5-turbo
    messages: [
      {
        role: 'system',
        content: '你是一位专业的技术总结助手，擅长分析代码提交记录并生成简洁明了的工作总结。'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 500
  };

  console.log('调用 OpenAI API');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API 错误响应:', errorText);
    throw new Error(`OpenAI API 调用失败: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  console.log('OpenAI API 响应:', result);

  if (!result.choices || result.choices.length === 0) {
    throw new Error('OpenAI API 返回数据格式错误');
  }

  return result.choices[0].message.content;
}

/**
 * 调用 OpenAI 中转 API
 */
async function callRelayAPI(apiKey, prompt) {
  const url = 'https://co.yes.vg/v1/chat/completions';

  const requestBody = {
    model: 'gpt-3.5-turbo',  // 使用 gpt-3.5-turbo
    messages: [
      {
        role: 'system',
        content: '你是一位专业的技术总结助手，擅长分析代码提交记录并生成简洁明了的工作总结。'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 500
  };

  console.log('调用 OpenAI 中转 API');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI 中转 API 错误响应:', errorText);
    throw new Error(`OpenAI 中转 API 调用失败: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  console.log('OpenAI 中转 API 响应:', result);

  if (!result.choices || result.choices.length === 0) {
    throw new Error('OpenAI 中转 API 返回数据格式错误');
  }

  return result.choices[0].message.content;
}

/**
 * 监听定时器事件
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkOALog') {
    console.log('定时检查 OA 日志...');
    await checkOALogAndRemind();
  }
});

/**
 * 检查 OA 日志并提醒
 * @see docs/oa-integration.md OA 集成文档
 * @see CLAUDE.md 项目规范
 */
async function checkOALogAndRemind() {
  try {
    // 检查当前时间是否为下午 5 点
    const now = new Date();
    const hour = now.getHours();

    // 只在下午 5 点（17:00-17:59）提醒
    if (hour !== 17) {
      console.log('当前时间不是下午 5 点，跳过检查');
      return;
    }

    // 获取配置
    const result = await chrome.storage.local.get(['systems', 'data', 'lastOAReminder']);
    const { systems, data, lastOAReminder } = result;

    // 检查 OA 是否启用
    if (!systems?.oa?.enabled) {
      console.log('OA 系统未启用，跳过检查');
      return;
    }

    // 检查今天是否已经提醒过（避免重复提醒）
    const today = now.toDateString();
    if (lastOAReminder === today) {
      console.log('今天已经提醒过，跳过');
      return;
    }

    // 检查是否有今日数据
    if (!data?.oa) {
      console.log('没有 OA 数据，先刷新数据');
      await refreshAllData();
      const newData = await chrome.storage.local.get(['data']);
      if (!newData?.data?.oa) {
        console.log('刷新后仍无 OA 数据，跳过提醒');
        return;
      }
    }

    // 重新获取数据
    const latestData = await chrome.storage.local.get(['data']);
    const oaData = latestData.data?.oa;

    // 检查是否已填写日志
    if (oaData && !oaData.hasLog && oaData.dateRange === 'today') {
      console.log('今日工作日志未填写，发送提醒');

      // 发送桌面通知
      chrome.notifications.create('oa-log-reminder', {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '工作日志提醒',
        message: '今日工作日志尚未填写，请及时完成填写！',
        priority: 2
      });

      // 记录今天已提醒
      await chrome.storage.local.set({ lastOAReminder: today });
    } else {
      console.log('今日工作日志已填写或未启用，无需提醒');
    }

  } catch (error) {
    console.error('检查 OA 日志失败:', error);
  }
}

console.log('后台服务脚本已加载');
