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
    enabled: true,
    dateRange: 'today'  // 默认查询今天：today, week, month
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
    refreshAllData().then(async (data) => {
      // 同时获取登录错误信息
      const storage = await chrome.storage.local.get(['gitlabLoginError', 'oaLoginError', 'zentaoLoginError']);
      sendResponse({
        success: true,
        data,
        gitlabLoginError: storage.gitlabLoginError,
        oaLoginError: storage.oaLoginError,
        zentaoLoginError: storage.zentaoLoginError
      });
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

  if (request.action === 'generateBugSummary') {
    generateBugAISummary().then(summary => {
      sendResponse({ success: true, summary });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // 异步响应
  }

  if (request.action === 'checkApiConfig') {
    checkApiConfig().then(result => {
      sendResponse(result);
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
    let zentaoLoginError = null;
    let gitlabLoginError = null;

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
        }
        // 特殊处理禅道登录错误
        else if (key === 'zentao' && error.needLogin) {
          zentaoLoginError = {
            message: error.message,
            loginUrl: error.loginUrl
          };
          console.log('捕获到禅道登录错误，保存到 storage:', zentaoLoginError);
        }
        // 特殊处理 GitLab 登录错误
        else if (key === 'gitlab' && error.needLogin) {
          gitlabLoginError = {
            message: error.message,
            loginUrl: error.loginUrl
          };
          console.log('捕获到 GitLab 登录错误，保存到 storage:', gitlabLoginError);
        }
        else {
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
      oaLoginError: oaLoginError,
      zentaoLoginError: zentaoLoginError,
      gitlabLoginError: gitlabLoginError
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
    console.log('[Zentao] 开始获取禅道数据...');

    // 并行获取两种类型的数据
    const [resolvedBugs, activeBugs, tasks] = await Promise.all([
      fetchZentaoResolvedBugs(config),  // 已解决的 Bug
      fetchZentaoActiveBugs(config),     // 未解决的 Bug
      fetchZentaoTasks(config)
    ]);

    // 合并两种 Bug
    const bugs = [...(activeBugs || []), ...(resolvedBugs || [])];

    const data = {
      bugs: bugs,
      tasks: tasks || []
    };

    console.log('[Zentao] 禅道数据获取成功:', {
      bugs: data.bugs.length,
      tasks: data.tasks.length
    });

    return data;

  } catch (error) {
    console.error('[Zentao] 获取禅道数据失败:', error);
    throw error;
  }
}

/**
 * 获取禅道 Bug 列表（已解决）
 */
async function fetchZentaoResolvedBugs(config) {
  try {
    // 先设置 cookie，控制每页显示 100 条
    const cookieUrl = new URL(config.baseURL);
    await chrome.cookies.set({
      url: config.baseURL,
      name: 'pagerMyBug',
      value: '100',
      domain: cookieUrl.hostname,
      path: '/'
    });
    console.log('[Zentao] 已设置 cookie: pagerMyBug=100');

    // 第一步：提交搜索条件
    const buildQueryUrl = `${config.baseURL}/index.php?m=search&f=buildQuery`;
    console.log('[Zentao] 提交搜索条件（已解决）:', buildQueryUrl);

    const formData = new URLSearchParams({
      // 所有字段（包括空字段）
      'fieldtitle': '',
      'fieldkeywords': '',
      'fieldsteps': '',
      'fieldassignedTo': '',
      'fieldresolvedBy': '',
      'fieldstatus': '',
      'fieldconfirmed': '',
      'fieldstory': '',
      'fieldproject': '',
      'fieldproduct': '',
      'fieldbranch': '0',
      'fieldplan': '',
      'fieldmodule': 'ZERO',
      'fieldexecution': '1012',
      'fieldseverity': '0',
      'fieldpri': '0',
      'fieldtype': '',
      'fieldos': '',
      'fieldbrowser': '',
      'fieldresolution': '',
      'fieldactivatedCount': '',
      'fieldtoTask': '',
      'fieldtoStory': '',
      'fieldopenedBy': '',
      'fieldclosedBy': '',
      'fieldlastEditedBy': '',
      'fieldmailto': '',
      'fieldopenedBuild': '',
      'fieldresolvedBuild': '',
      'fieldopenedDate': '',
      'fieldassignedDate': '',
      'fieldresolvedDate': '',
      'fieldclosedDate': '',
      'fieldlastEditedDate': '',
      'fielddeadline': '',
      'fieldactivatedDate': '',
      'fieldstage': '',
      'requirementPhase': '',
      'fieldid': '',

      // 搜索条件1：解决日期为上个月
      'andOr1': 'AND',
      'field1': 'resolvedDate',
      'operator1': 'between',
      'value1': '$lastMonth',

      // 搜索条件2：模块
      'andOr2': 'and',
      'field2': 'module',
      'operator2': 'belong',
      'value2': 'ZERO',

      // 搜索条件3：关键词
      'andOr3': 'and',
      'field3': 'keywords',
      'operator3': 'include',
      'value3': '',

      'groupAndOr': 'and',

      // 搜索条件4：步骤
      'andOr4': 'AND',
      'field4': 'steps',
      'operator4': 'include',
      'value4': '',

      // 搜索条件5：指派给
      'andOr5': 'and',
      'field5': 'assignedTo',
      'operator5': '=',
      'value5': '',

      // 搜索条件6：由谁解决
      'andOr6': 'and',
      'field6': 'resolvedBy',
      'operator6': '=',
      'value6': '',

      // 其他必需参数
      'module': 'contributeBug',
      'actionURL': '/index.php?m=my&f=contribute&mode=bug&browseType=bySearch&queryID=myQueryID',
      'groupItems': '3',
      'formType': 'lite'
    });

    console.log('[Zentao] POST 请求体:', formData.toString());
    console.log('[Zentao] POST 请求体大小:', formData.toString().length, '字节');

    const buildQueryResponse = await fetch(buildQueryUrl, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json, text/html'
      },
      body: formData
    });

    if (!buildQueryResponse.ok) {
      throw new Error(`构建查询失败: ${buildQueryResponse.status}`);
    }

    const buildQueryResponseText = await buildQueryResponse.text();
    console.log('[Zentao] 搜索条件提交响应:', buildQueryResponseText.substring(0, 500));
    console.log('[Zentao] 响应状态码:', buildQueryResponse.status);
    console.log('[Zentao] 响应头 Content-Type:', buildQueryResponse.headers.get('Content-Type'));

    // 第二步：获取 Bug 列表页面
    const url = `${config.baseURL}/index.php?m=my&f=contribute&mode=bug&browseType=bySearch&queryID=myQueryID`;
    console.log('[Zentao] 请求已解决 Bug 列表:', url);

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

    // 检测登录状态
    if (html.includes('self.location') && html.includes('m=user&f=login')) {
      console.log('[Zentao] 检测到登录重定向');
      const loginError = new Error('请重新登录禅道系统');
      loginError.needLogin = true;
      loginError.loginUrl = `${config.baseURL}/index.php?m=user&f=login`;
      throw loginError;
    }

    // 解析 Bug 列表，传入 status='resolved'
    const bugs = parseZentaoBugs(html, config.baseURL, 'resolved');
    console.log(`[Zentao] 解析到 ${bugs.length} 个已解决 Bug`);

    return bugs;

  } catch (error) {
    console.error('[Zentao] 获取已解决 Bug 列表失败:', error);
    if (error.needLogin) throw error;
    return [];
  }
}

/**
 * 获取禅道 Bug 列表（未解决/待处理）
 */
async function fetchZentaoActiveBugs(config) {
  try {
    // 先设置 cookie，控制每页显示 100 条
    const cookieUrl = new URL(config.baseURL);
    await chrome.cookies.set({
      url: config.baseURL,
      name: 'pagerMyBug',
      value: '100',
      domain: cookieUrl.hostname,
      path: '/'
    });
    console.log('[Zentao] 已设置 cookie: pagerMyBug=100');

    const url = `${config.baseURL}/index.php?m=my&f=work&mode=bug`;
    console.log('[Zentao] 请求未解决 Bug 列表:', url);

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

    // 检测登录状态
    if (html.includes('self.location') && html.includes('m=user&f=login')) {
      console.log('[Zentao] 检测到登录重定向');
      const loginError = new Error('请重新登录禅道系统');
      loginError.needLogin = true;
      loginError.loginUrl = `${config.baseURL}/index.php?m=user&f=login`;
      throw loginError;
    }

    // 解析 Bug 列表，传入 status='active'
    const bugs = parseZentaoBugs(html, config.baseURL, 'active');
    console.log(`[Zentao] 解析到 ${bugs.length} 个未解决 Bug`);

    return bugs;

  } catch (error) {
    console.error('[Zentao] 获取未解决 Bug 列表失败:', error);
    if (error.needLogin) throw error;
    return [];
  }
}

/**
 * 解析禅道 Bug HTML（使用正则表达式，适用于 Service Worker）
 * @param {string} html - HTML内容
 * @param {string} baseURL - 基础URL
 * @param {string} status - Bug状态：'resolved'(已解决) 或 'active'(未解决)
 */
function parseZentaoBugs(html, baseURL, status = 'resolved') {
  const bugs = [];

  try {
    console.log('[Zentao] HTML 长度:', html.length);
    console.log('[Zentao] HTML 前500字符:', html.substring(0, 500));

    // 查找 id='bugList' 或 id="bugList" 的 table（兼容单双引号）
    const tableRegex = /<table[^>]*id=['"]bugList['"][^>]*>([\s\S]*?)<\/table>/i;
    const tableMatch = html.match(tableRegex);

    if (!tableMatch) {
      console.error('[Zentao] 未找到 id="bugList" 的表格');
      console.log('[Zentao] 检查 HTML 是否包含 bugList:', html.includes('bugList'));
      return bugs;
    }

    console.log('[Zentao] 成功找到 bugList 表格，长度:', tableMatch[0].length);

    // 提取 tbody 内容
    const tbodyRegex = /<tbody[^>]*>([\s\S]*?)<\/tbody>/i;
    const tbodyMatch = tableMatch[1].match(tbodyRegex);

    if (!tbodyMatch) {
      console.error('[Zentao] 未找到 tbody 标签');
      return bugs;
    }

    const tbodyContent = tbodyMatch[1];
    console.log('[Zentao] 成功提取 tbody，长度:', tbodyContent.length);

    // 提取所有的 tr 标签
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const trMatches = tbodyContent.matchAll(trRegex);

    let rowIndex = 0;
    for (const trMatch of trMatches) {
      try {
        const rowContent = trMatch[1];

        // 调试：输出前2行的HTML
        if (rowIndex < 2) {
          console.log(`[Zentao] 第 ${rowIndex + 1} 行 HTML (前500字符):`, rowContent.substring(0, 500));
        }

        // 提取所有的 td 列
        const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        const tdMatches = [...rowContent.matchAll(tdRegex)];

        if (tdMatches.length < 2) {
          console.log(`[Zentao] 第 ${rowIndex + 1} 行：td 列数不足，跳过`);
          rowIndex++;
          continue;
        }

        if (rowIndex < 2) {
          console.log(`[Zentao] 第 ${rowIndex + 1} 行：找到 ${tdMatches.length} 列`);
        }

        // 第一列：提取 Bug ID
        const firstCol = tdMatches[0][1];
        const idMatch = firstCol.match(/value=['"](\d+)['"]/);
        if (!idMatch) {
          console.log(`[Zentao] 第 ${rowIndex + 1} 行：未找到 Bug ID，跳过`);
          rowIndex++;
          continue;
        }
        const id = parseInt(idMatch[1]);

        if (rowIndex < 2) {
          console.log(`[Zentao] 第 ${rowIndex + 1} 行：Bug ID = ${id}`);
        }

        // 第二列：提取标题和链接
        const secondCol = tdMatches[1][1];
        const linkMatch = secondCol.match(/<a[^>]*href=['"]([^'"]*)['"'][^>]*title=['"]([^'"]*)['"'][^>]*>([^<]*)<\/a>/i);

        let title = '';
        let href = '';

        if (linkMatch) {
          href = linkMatch[1];
          title = linkMatch[2] || linkMatch[3].trim();
        }

        // 如果 title 仍为空，尝试从链接文本提取
        if (!title && linkMatch) {
          title = linkMatch[3].trim();
        }

        const url = href ? `${baseURL}${href}` : '';

        if (rowIndex < 2) {
          console.log(`[Zentao] 第 ${rowIndex + 1} 行：标题 = "${title.substring(0, 50)}..."`);
          console.log(`[Zentao] 第 ${rowIndex + 1} 行：URL = ${url}`);
        }

        // 倒数第二列：提取状态/方案
        const secondLastCol = tdMatches[tdMatches.length - 2][1];
        const resolution = secondLastCol.replace(/<[^>]*>/g, '').trim();

        if (rowIndex < 2) {
          console.log(`[Zentao] 第 ${rowIndex + 1} 行：方案 = "${resolution}"`);
        }

        // 提取其他可选字段
        // 严重程度（第3列）
        let severity = 3;
        let severityText = '';
        if (tdMatches.length > 2) {
          const severityCol = tdMatches[2][1];
          const severityMatch = severityCol.match(/data-severity=['"](\d+)['"]/i);
          const severityTitleMatch = severityCol.match(/title=['"]([^'"]*)['"]/i);
          if (severityMatch) severity = parseInt(severityMatch[1]);
          if (severityTitleMatch) severityText = severityTitleMatch[1];
        }

        // 优先级（第4列）
        let priority = '正常';
        if (tdMatches.length > 3) {
          const priCol = tdMatches[3][1];
          const priMatch = priCol.match(/title=['"]([^'"]*)['"]/i);
          if (priMatch) priority = priMatch[1];
        }

        // 指派给（倒数第3列）
        let assignedTo = '';
        if (tdMatches.length > 2) {
          const assignedCol = tdMatches[tdMatches.length - 3][1];
          const assignedMatch = assignedCol.match(/title=['"]([^'"]*)['"]/i);
          if (assignedMatch) assignedTo = assignedMatch[1];
        }

        if (id && title) {
          bugs.push({
            id,
            title,
            status: status,  // 使用参数传入的状态
            severity,
            severityText,
            priority,
            assignedTo,
            resolution,
            url
          });

          if (rowIndex < 3) {
            console.log(`[Zentao] ✓ Bug #${id}: ${title.substring(0, 30)}...`);
          }
        } else {
          console.log(`[Zentao] ✗ 第 ${rowIndex + 1} 行跳过 - ID:${id}, 标题:"${title.substring(0, 20)}"`);
        }

        rowIndex++;
      } catch (error) {
        console.error(`[Zentao] 解析第 ${rowIndex + 1} 行失败:`, error);
        rowIndex++;
      }
    }

  } catch (error) {
    console.error('[Zentao] 解析 Bug HTML 失败:', error);
  }

  console.log(`[Zentao] 最终解析结果: ${bugs.length} 个 Bug`);
  return bugs;
}

/**
 * 获取禅道任务列表（待处理）
 */
async function fetchZentaoTasks(config) {
  try {
    // 设置 cookie，控制每页显示 100 条
    const cookieUrl = new URL(config.baseURL);
    await chrome.cookies.set({
      url: config.baseURL,
      name: 'pagerTask',
      value: '100',
      domain: cookieUrl.hostname,
      path: '/'
    });
    console.log('[Zentao] 已设置 cookie: pagerTask=100');

    const url = `${config.baseURL}/index.php?m=my&f=work&mode=task`;
    console.log('[Zentao] 请求任务列表:', url);

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

    // 检测登录状态
    if (html.includes('self.location') && html.includes('m=user&f=login')) {
      console.log('[Zentao] 检测到登录重定向');
      const loginError = new Error('请重新登录禅道系统');
      loginError.needLogin = true;
      loginError.loginUrl = `${config.baseURL}/index.php?m=user&f=login`;
      throw loginError;
    }

    // 解析任务列表
    const tasks = parseZentaoTasks(html, config.baseURL);
    console.log(`[Zentao] 解析到 ${tasks.length} 个任务`);

    return tasks;

  } catch (error) {
    console.error('[Zentao] 获取任务列表失败:', error);
    if (error.needLogin) throw error;
    return [];
  }
}

/**
 * 解析禅道任务 HTML
 * @param {string} html - HTML内容
 * @param {string} baseURL - 基础URL
 */
function parseZentaoTasks(html, baseURL) {
  const tasks = [];

  try {
    console.log('[Zentao] 开始解析任务，HTML 长度:', html.length);

    // 查找 id='taskTable' 的 table
    const tableRegex = /<table[^>]*id=['"]taskTable['"][^>]*>([\s\S]*?)<\/table>/i;
    const tableMatch = html.match(tableRegex);

    if (!tableMatch) {
      console.error('[Zentao] 未找到 id="taskTable" 的表格');
      return tasks;
    }

    console.log('[Zentao] 成功找到 taskTable 表格');

    // 提取 tbody 内容
    const tbodyRegex = /<tbody[^>]*>([\s\S]*?)<\/tbody>/i;
    const tbodyMatch = tableMatch[1].match(tbodyRegex);

    if (!tbodyMatch) {
      console.error('[Zentao] 未找到 tbody 标签');
      return tasks;
    }

    const tbodyContent = tbodyMatch[1];
    console.log('[Zentao] 成功提取 tbody，长度:', tbodyContent.length);

    // 提取所有的 tr 标签
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const trMatches = tbodyContent.matchAll(trRegex);

    let rowIndex = 0;
    for (const trMatch of trMatches) {
      try {
        const rowContent = trMatch[1];

        // 提取所有的 td 列
        const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        const tdMatches = [...rowContent.matchAll(tdRegex)];

        if (tdMatches.length < 4) {
          console.log(`[Zentao] 第 ${rowIndex + 1} 行：td 列数不足，跳过`);
          rowIndex++;
          continue;
        }

        if (rowIndex < 2) {
          console.log(`[Zentao] 第 ${rowIndex + 1} 行：找到 ${tdMatches.length} 列`);
        }

        // 第一列：提取任务 ID
        const firstCol = tdMatches[0][1];
        const idMatch = firstCol.match(/value=['"](\d+)['"]/);
        if (!idMatch) {
          console.log(`[Zentao] 第 ${rowIndex + 1} 行：未找到任务 ID，跳过`);
          rowIndex++;
          continue;
        }
        const id = parseInt(idMatch[1]);

        // 第二列（c-name）：提取任务名称和链接
        const secondCol = tdMatches[1][1];
        const linkMatch = secondCol.match(/<a[^>]*href=['"]([^'"]*)['"'][^>]*>([^<]*)<\/a>/i);

        let name = '';
        let href = '';

        if (linkMatch) {
          href = linkMatch[1];
          name = linkMatch[2].trim();
        }

        const url = href ? `${baseURL}${href}` : '';

        if (rowIndex < 2) {
          console.log(`[Zentao] 第 ${rowIndex + 1} 行：任务名 = "${name}"`);
          console.log(`[Zentao] 第 ${rowIndex + 1} 行：URL = ${url}`);
        }

        // 第四列（c-status）：提取状态
        const fourthCol = tdMatches[3][1];
        const statusMatch = fourthCol.match(/class=['"]status-[^'"]*['"][^>]*>([^<]*)</i);
        const status = statusMatch ? statusMatch[1].trim() : '';

        if (rowIndex < 2) {
          console.log(`[Zentao] 第 ${rowIndex + 1} 行：状态 = "${status}"`);
        }

        // 倒数第6列：提取预计工时
        let estimate = 0;
        if (tdMatches.length >= 6) {
          const estimateCol = tdMatches[tdMatches.length - 6][1];
          // 移除HTML标签，提取数字
          const estimateText = estimateCol.replace(/<[^>]*>/g, '').trim();
          const estimateNum = parseFloat(estimateText);
          if (!isNaN(estimateNum)) {
            estimate = estimateNum;
          }

          if (rowIndex < 2) {
            console.log(`[Zentao] 第 ${rowIndex + 1} 行：预计工时 = ${estimate}`);
          }
        }

        if (id && name) {
          tasks.push({
            id,
            name,
            status,
            estimate,
            url
          });

          if (rowIndex < 3) {
            console.log(`[Zentao] ✓ 任务 #${id}: ${name.substring(0, 30)}...`);
          }
        }

        rowIndex++;
      } catch (error) {
        console.error(`[Zentao] 解析第 ${rowIndex + 1} 行失败:`, error);
        rowIndex++;
      }
    }

  } catch (error) {
    console.error('[Zentao] 解析任务 HTML 失败:', error);
  }

  console.log(`[Zentao] 最终解析结果: ${tasks.length} 个任务`);
  return tasks;
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

    // 根据日期范围设置不同的 limit
    const dateRange = config.dateRange || 'today';
    let limit;
    switch (dateRange) {
      case 'today':
        limit = 18;   // 今日 18 条
        break;
      case 'week':
        limit = 50;   // 本周 50 条
        break;
      case 'month':
        limit = 120;  // 本月 120 条
        break;
      default:
        limit = 18;
    }

    const url = `${config.baseURL}/users/${username}/activity?limit=${limit}`;
    console.log('请求 GitLab URL:', url, '日期范围:', dateRange);

    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });

    // 检测是否被重定向到登录页面
    // GitLab 未登录时会 302 重定向到 /users/sign_in
    if (response.redirected && response.url.includes('sign_in')) {
      console.log('检测到 GitLab 登录重定向，redirected:', response.redirected, 'url:', response.url);
      const loginError = new Error('请重新登录 GitLab 系统');
      loginError.needLogin = true;
      loginError.loginUrl = `${config.baseURL}/users/sign_in`;
      throw loginError;
    }

    // 检查状态码（未登录可能返回 401/403/404）
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      console.log('检测到 GitLab 认证失败，状态码:', response.status);
      const loginError = new Error('请重新登录 GitLab 系统');
      loginError.needLogin = true;
      loginError.loginUrl = `${config.baseURL}/users/sign_in`;
      throw loginError;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    console.log('GitLab 返回数据，count:', json.count);

    // 解析 HTML 提取数据，传入日期范围
    const data = parseGitLabHTML(json.html, dateRange);
    return data;

  } catch (error) {
    console.error('获取 GitLab 数据失败:', error);
    throw error;
  }
}

/**
 * 解析 GitLab HTML 数据
 * @param {string} html - HTML内容
 * @param {string} dateRange - 日期范围：today, week, month
 */
function parseGitLabHTML(html, dateRange = 'today') {
  const data = {
    commits: 0,
    commitMessages: [],  // 保存提交消息
    dateRange: dateRange,
    // MR 和项目统计（待验证）
    mergeRequests: {
      created: 0,
      merged: 0,
      approved: 0
    },
    projects: {}  // 项目分布 { projectName: count }
  };

  try {
    // 计算日期范围
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let startDate;

    switch (dateRange) {
      case 'today':
        startDate = today;
        break;
      case 'week':
        const dayOfWeek = now.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startDate = new Date(today);
        startDate.setDate(today.getDate() + diff);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = today;
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];
    console.log('日期范围:', dateRange, '起始日期:', startDateStr, '结束日期:', todayStr);

    // 提取所有包含 event-item 的 li 标签
    const eventItemRegex = /<li class="event-item[^"]*"[^>]*>([\s\S]*?)(?=<li class="event-item|$)/g;
    const eventMatches = html.matchAll(eventItemRegex);

    // 调试：记录不同类型的图标
    let iconDebug = new Set();

    for (const match of eventMatches) {
      const eventContent = match[1];

      // 提取时间信息
      const timeMatch = eventContent.match(/<time[^>]*datetime="([^"]+)"/i);
      if (!timeMatch) continue;

      const datetime = timeMatch[1];
      const activityDate = datetime.split('T')[0];

      // 判断是否在日期范围内
      if (activityDate < startDateStr || activityDate > todayStr) continue;

      // 通过 SVG data-testid 判断操作类型
      const iconMatch = eventContent.match(/data-testid="([^"]+)-icon"/);
      const iconType = iconMatch ? iconMatch[1] : null;

      // 调试：记录图标类型
      if (iconType) {
        iconDebug.add(iconType);
      }

      // === 处理提交事件 (commit-icon) ===
      if (iconType === 'commit') {
        data.commits++;

        // 提取提交消息
        const commitMessages = extractCommitMessages(eventContent);
        data.commitMessages.push(...commitMessages);

        // 提取项目名称（仅在提交事件中统计项目）
        const projectName = extractProjectNameFromAt(eventContent);
        if (projectName) {
          data.projects[projectName] = (data.projects[projectName] || 0) + 1;
        }
      }

      // === 处理 Merge Request 事件 (fork-icon 表示合并) ===
      if (iconType === 'fork') {
        // fork-icon 通常表示 MR 相关操作
        if (eventContent.includes('accepted') || eventContent.includes('merged')) {
          data.mergeRequests.merged++;
        }
      }

      // === 处理其他 MR 事件 ===
      if (eventContent.includes('merge request')) {
        if (eventContent.includes('created') || eventContent.includes('opened')) {
          data.mergeRequests.created++;
        }
        if (eventContent.includes('approved')) {
          data.mergeRequests.approved++;
        }
      }
    }

    console.log('发现的图标类型:', Array.from(iconDebug));
    console.log(`\n解析 GitLab 数据 (${dateRange}):`, {
      commits: data.commits,
      mergeRequests: data.mergeRequests,
      projectsCount: Object.keys(data.projects).length,
      projects: data.projects
    });

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
 * 从事件内容中提取项目名称
 * @param {string} eventContent - 事件HTML内容
 * @returns {string|null} 项目名称
 */
function extractProjectName(eventContent) {
  try {
    // 匹配项目链接，支持多层级路径（如 /group/subgroup/project 或 /xmabr/apt/lesterpweb/lesterpweb）
    const projectRegex = /<a[^>]*href="\/([^"]+)"[^>]*>/;
    const match = eventContent.match(projectRegex);

    if (match && match[1]) {
      const path = match[1];
      // 确保路径包含至少一个斜杠（即至少是 group/project 格式）
      // 避免匹配到非项目路径（如 /users/sign_in）
      if (path.includes('/') && !path.includes('users/') && !path.includes('help/')) {
        return path;
      }
    }

    // 备用方案：匹配 data-project 属性
    const dataProjectRegex = /data-project="([^"]+)"/;
    const dataMatch = eventContent.match(dataProjectRegex);
    if (dataMatch && dataMatch[1]) {
      return dataMatch[1];
    }

  } catch (error) {
    console.error('提取项目名称失败:', error);
  }

  return null;
}

/**
 * 提取项目名称
 * 从 <span class="project-name"> 中提取项目名称
 * @param {string} eventContent - 事件HTML内容
 * @returns {string|null} 项目名称
 */
function extractProjectNameFromAt(eventContent) {
  try {
    // 提取 <span class="project-name">项目名</span> 中的内容
    const projectNameRegex = /<span class="project-name">([^<]+)<\/span>/;
    const match = eventContent.match(projectNameRegex);

    if (match && match[1]) {
      return match[1].trim();
    }

  } catch (error) {
    console.error('提取项目名称失败:', error);
  }

  return null;
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
 * 分析工作内容（AI）
 */
async function generateAISummary() {
  console.log('开始分析工作内容...');

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

    // 检查提交数据
    if (!data?.gitlab?.commitMessages || data.gitlab.commitMessages.length === 0) {
      throw new Error('暂无提交记录');
    }

    const gitlabData = data.gitlab;
    const commitMessages = gitlabData.commitMessages;
    const dateRange = gitlabData.dateRange || 'today';

    // 根据时间范围设置文案
    const dateRangeMap = {
      today: '今日',
      week: '本周',
      month: '本月'
    };
    const dateRangeText = dateRangeMap[dateRange] || '今日';

    console.log('提交消息:', commitMessages);
    console.log('时间范围:', dateRangeText);

    // 构建统计摘要
    let statsText = `提交记录：\n${commitMessages.map((msg, i) => `${i + 1}. ${msg}`).join('\n')}`;

    // 统计提交数量
    statsText += `\n\n总提交数：${gitlabData.commits || 0} 次`;

    // 添加 MR 合并统计
    if (gitlabData.mergeRequests && gitlabData.mergeRequests.merged > 0) {
      statsText += `\n合并 MR：${gitlabData.mergeRequests.merged} 个`;
    }

    // 添加项目分布
    if (gitlabData.projects && Object.keys(gitlabData.projects).length > 0) {
      const projectList = Object.entries(gitlabData.projects)
        .sort((a, b) => b[1] - a[1]) // 按提交次数排序
        .map(([name, count]) => `${name}(${count}次)`)
        .join('、');
      statsText += `\n\n项目：${projectList}`;
    }

    // 构建 prompt
    const prompt = `你是一位专业的技术分析助手。根据以下${dateRangeText}的 Git 活动记录，分析工作内容：

${statsText}

请用中文分析${dateRangeText}完成的工作，要求：
1. 分析提交记录，归纳主要工作内容
2. 按功能模块分类（如果有多个模块）
3. 使用简洁的列表形式

4. **重点：在分析最后，请客观指出工作中存在的不足，并给出改进建议**（2-3句话）。请从以下维度评估：
   - 工作量：提交数是否偏少？如果少于 5 次，建议注意工作产出或及时提交代码备份
   - 工作集中度：是否涉及过多项目？如果项目超过 2 个，建议集中精力先完成主要模块
   - 代码审查：合并 MR 数量是否合理？如果为 0，建议多参与代码审查和团队协作
   - 提交质量：提交信息是否清晰？是否有过多的琐碎修改？

   **请直接指出问题，不要过度美化。目的是帮助改进工作方式。**

格式示例：
• 功能开发：...
• Bug 修复：...
• 代码审查：...
• 优化改进：...

⚠️ 改进建议：[直接指出具体问题] + [给出具体改进方向]`;

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
async function callZhipuAPI(apiKey, prompt, maxTokens = 500, systemPrompt = '你是一位专业的技术分析助手，擅长分析代码提交记录并输出简洁明了的工作内容分析。') {
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
      return [];
    }

    const data = await response.json();
    console.log('SerpAPI 响应:', data);

    // 解析图片结果 - 获取前3张图片
    const imageUrls = [];

    if (data.images_results && data.images_results.length > 0) {
      // 获取前3张图片（如果不足3张则获取全部）
      const count = Math.min(3, data.images_results.length);

      for (let i = 0; i < count; i++) {
        const image = data.images_results[i];
        const imageUrl = image.original || image.thumbnail || '';
        if (imageUrl) {
          imageUrls.push(imageUrl);
        }
      }
    }

    if (imageUrls.length > 0) {
      console.log(`✅ 找到 ${imageUrls.length} 张图片:`, imageUrls);
    } else {
      console.warn('⚠️ 未找到图片结果');
      console.warn('响应数据结构:', JSON.stringify(data, null, 2));
    }

    return imageUrls;

  } catch (error) {
    console.error('SerpAPI 搜索图片失败:', error);
    return [];
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

    // 2. 检查 AI API 配置
    const provider = systems.zhipu?.provider || 'zhipu';
    const apiKey = systems.zhipu?.apiKey;

    if (!apiKey) {
      const errorMsg = '菜品详情功能需要配置 AI API。\n\n请点击扩展图标，进入设置页面配置 AI 服务商和 API Key。';
      throw new Error(errorMsg);
    }

    // 3. 生成 Prompt（不含图片）
    const prompt = generateDishAnalysisPrompt(dishName, mealType);

    // 4. 调用 AI 生成菜品信息
    const systemPrompt = '你是一位专业的美食顾问，擅长分析菜品特点。';
    console.log('生成菜品信息:', dishName, '使用AI:', provider);

    let response;
    switch (provider) {
      case 'zhipu':
        response = await callZhipuAPI(apiKey, prompt, 500, systemPrompt);
        break;
      case 'aliyun':
        response = await callAliyunAPI(apiKey, prompt);
        break;
      case 'openai':
      case 'relay':
        response = await callOpenAI(apiKey, prompt, provider === 'relay');
        break;
      default:
        throw new Error('不支持的 AI 服务商');
    }

    // 5. 解析 JSON
    const dishData = extractJSONFromResponse(response);

    if (!dishData) {
      throw new Error('AI返回数据无法解析为JSON');
    }

    // 6. 验证数据
    if (!dishData.dishName || !dishData.intro ||
        !Array.isArray(dishData.ingredients) ||
        !Array.isArray(dishData.cookingMethods) ||
        !Array.isArray(dishData.cookingSteps)) {
      console.warn('AI返回数据格式不完整:', dishData);
      throw new Error('AI返回数据格式无效');
    }

    // 7. 使用 SerpAPI 搜索图片（如果已配置）
    let imageUrls = [];

    if (serpapi && serpapi.apiKey) {
      const engine = serpapi.engine || 'bing';  // 默认 Bing（国内访问稳定）
      console.log('使用 SerpAPI 搜索图片...');
      imageUrls = await searchDishImage(dishName, serpapi.apiKey, engine);
    } else {
      console.warn('⚠️ SerpAPI 未配置，图片将显示为空。如需显示图片，请在设置中配置 SerpAPI Key。');
    }

    // 8. 合并数据
    dishData.imageUrls = imageUrls;  // 改为数组
    dishData.timestamp = Date.now();

    console.log('✅ 菜品详情生成完成:', dishData);
    return dishData;

  } catch (error) {
    console.error('生成菜品详情失败:', error);
    throw error; // 抛出错误让上层处理
  }
}

/**
 * 检查 API 配置状态
 * @returns {Promise<Object>} 配置检查结果
 */
async function checkApiConfig() {
  try {
    const result = await chrome.storage.local.get(['systems', 'serpapi']);
    const systems = result.systems || {};
    const serpapi = result.serpapi || {};

    const provider = systems.zhipu?.provider || 'zhipu';
    const aiApiKey = systems.zhipu?.apiKey;
    const serpapiKey = serpapi?.apiKey;

    // 检查 AI API 配置
    if (!aiApiKey) {
      return {
        success: false,
        missingConfigs: ['ai'],
        message: '⚙️ 需要配置 AI API\n\n菜品详情功能需要 AI 来分析菜品的食材、做法等信息。\n\n请点击扩展图标，进入设置页面：\n1. 选择 AI 服务商（智谱 AI / 阿里云 / OpenAI）\n2. 填写对应的 API Key'
      };
    }

    // AI 已配置，检查 SerpAPI（可选）
    if (!serpapiKey) {
      return {
        success: true,
        warning: true,
        missingConfigs: ['serpapi'],
        message: '⚠️ 图片功能未配置\n\n菜品详情将不显示图片。如需显示菜品图片，请配置 SerpAPI Key（可选）。'
      };
    }

    // 所有配置完整
    return {
      success: true,
      message: '配置完整'
    };

  } catch (error) {
    console.error('检查配置失败:', error);
    return {
      success: false,
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
          content: '你是一位专业的技术分析助手，擅长分析代码提交记录并输出简洁明了的工作内容分析。'
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

/**
 * 生成 Bug AI 总结（批判性分析）
 */
async function generateBugAISummary() {
  console.log('开始生成 Bug AI 总结...');

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

    // 检查 Bug 数据
    if (!data?.zentao?.bugs || data.zentao.bugs.length === 0) {
      throw new Error('暂无 Bug 数据');
    }

    const bugs = data.zentao.bugs;
    console.log('Bug 数量:', bugs.length);

    // 构建 Bug 列表文本
    const bugListText = bugs.map((bug, index) => {
      return `${index + 1}. [${bug.status === 'active' ? '待处理' : '已解决'}] ${bug.title}`;
    }).join('\n');

    // 统计 Bug 状态
    const activeBugs = bugs.filter(b => b.status === 'active').length;
    const resolvedBugs = bugs.filter(b => b.status === 'resolved').length;

    // 构建批判性的 prompt
    const prompt = `你是一位严格的技术质量顾问。请对以下本月 Bug 数据进行**批判性分析**，并给出改进建议。

**Bug 统计**：
- 总数：${bugs.length} 个
- 待处理：${activeBugs} 个
- 已解决：${resolvedBugs} 个

**Bug 列表**：
${bugListText}

**分析要求**：
1. **问题诊断**（直接指出问题，不要美化）：
   - Bug 数量是否过多？如果超过 10 个，说明代码质量有问题
   - 待处理 Bug 占比是否过高？如果超过 30%，说明修复速度太慢
   - **重点：从 Bug 标题中识别重复模块/功能**（如"配方单位"出现多次、"订单"相关 Bug 集中等）
   - 是否有严重 Bug？（从标题中推测）

2. **根本原因分析**（简洁，2-3 条核心原因，**必须基于实际 Bug 标题**）：
   - **禁止使用泛泛的术语**（如"测试覆盖率不足"、"代码复杂度较高"、"部分模块设计不合理"）
   - **必须从实际 Bug 标题中提取信息**，例如：
     * 如果"配方单位"相关 Bug 出现 3 次以上 → 说明"配方单位模块需求不够完善，边界条件考虑不足"
     * 如果"订单状态"相关 Bug 集中 → 说明"订单状态流转逻辑存在漏洞"
     * 如果多个"页面显示"Bug → 说明"前端数据渲染缺少空值校验"
   - **引用具体 Bug 标题作为证据**

3. **改进建议**（简洁，3-4 条核心建议，**针对具体模块**）：
   - **禁止空话套话**（如"加强代码审查"、"提高测试覆盖率"）
   - **必须针对具体模块给出建议**，例如：
     * "重构配方单位模块，补充单位转换的边界测试用例"
     * "梳理订单状态流转图，补充状态机测试"
     * "前端统一添加数据校验工具函数"

**输出格式**：
## 📊 Bug 概况
[统计数据分析，2-3句话]

## ⚠️ 问题诊断
[直接指出问题，3-4个要点，**必须引用具体 Bug 标题**]

## 🔍 根本原因
- [原因1：基于具体 Bug 标题分析，例如："配方单位"相关 Bug（#123、#145、#167）反复出现，说明...]
- [原因2：同样基于实际数据]

## 💡 改进建议
- [建议1：针对具体模块，例如："针对配方单位模块，建议..."]
- [建议2：针对具体问题]
- [建议3：针对具体场景]

**关键要求**：
- ⚠️ 严禁使用"测试覆盖率不足"、"代码复杂度高"等泛泛术语
- ✅ 必须从实际 Bug 标题中提取模块名、功能点，作为分析依据
- ✅ 根本原因必须引用具体 Bug 编号或标题作为证据
- ✅ 改进建议必须针对具体模块和场景，可直接执行`;

    // 调用对应的 AI API
    let summary;

    switch (provider) {
      case 'zhipu':
        summary = await callZhipuAPI(systems.zhipu.apiKey, prompt, 800, '你是一位严格的技术质量顾问，擅长从 Bug 数据中发现问题并给出改进建议。');
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

    console.log('生成的 Bug 总结:', summary);
    return summary;

  } catch (error) {
    console.error('生成 Bug AI 总结失败:', error);
    throw error;
  }
}

console.log('后台服务脚本已加载');
