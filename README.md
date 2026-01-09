# 工作流聚合助手

一个浏览器扩展，用于聚合 OA、禅道、GitLab 等多个工作平台的待办事项和工作数据。

## 功能特性

- ✅ 统一查看多个工作平台的数据
- ✅ 自动携带 Cookie 实现免登录访问
- ✅ 定时后台刷新数据（每30分钟）
- ✅ 支持手动刷新
- ✅ 灵活的系统配置

## 支持的系统

- **OA 系统**: 待办事项、日志日程、食堂订餐、考勤情况
- **禅道**: 剩余任务、待修复 Bug
- **GitLab**: 今日提交、待审查 MR

## 安装方法

### 1. Chrome/Edge 浏览器

1. 打开浏览器，访问 `chrome://extensions/` (Edge 使用 `edge://extensions/`)
2. 开启右上角的「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本项目的根目录 `work-dashboard`
5. 扩展安装完成！

### 2. Firefox 浏览器

1. 打开浏览器，访问 `about:debugging#/runtime/this-firefox`
2. 点击「临时载入附加组件」
3. 选择项目中的 `manifest.json` 文件
4. 扩展安装完成！

## 使用步骤

### 第一步：配置系统地址

1. 点击浏览器工具栏的扩展图标
2. 点击右上角的 ⚙️ 设置图标
3. 勾选需要启用的系统
4. 填写各系统的访问地址
5. 点击「保存配置」

示例配置：
```
✅ OA 系统: http://oa.company.com
✅ 禅道: http://zentao.company.com
✅ GitLab: http://gitlab.company.com
```

### 第二步：登录各系统

在浏览器中正常访问并登录各个系统（OA、禅道、GitLab），浏览器会自动保存 Cookie。

### 第三步：查看聚合数据

点击扩展图标，即可看到所有系统的聚合数据！

## 项目结构

```
work-dashboard/
├── manifest.json          # 扩展配置文件
├── popup.html            # 弹出页面 HTML
├── popup.css             # 弹出页面样式
├── popup.js              # 弹出页面脚本
├── src/
│   └── background.js     # 后台服务脚本
├── icons/                # 图标文件夹（需要自行添加图标）
└── README.md            # 项目说明
```

## 开发说明

### 核心机制

1. **Cookie 共享**: 扩展可以访问浏览器中所有已保存的 Cookie
2. **后台服务**: background.js 在后台运行，定时获取数据
3. **跨域请求**: 通过 manifest 中的 `host_permissions` 实现跨域访问
4. **本地存储**: 使用 `chrome.storage.local` 缓存数据

### 下一步开发

当前版本只实现了基础框架，后续需要：

1. **实现各系统的 API 调用**
   - 在 `background.js` 中的 `fetchSystemData()` 函数编写实际的 API 请求
   - 根据各系统的 API 文档编写数据获取逻辑

2. **优化数据展示**
   - 在 `popup.js` 中的 `renderData()` 函数完善数据渲染
   - 根据实际数据结构更新 UI 显示

3. **添加图标**
   - 在 `icons/` 目录下添加 16x16、48x48、128x128 的 PNG 图标
   - 可以使用在线工具生成多尺寸图标

4. **错误处理**
   - 完善认证失败的处理逻辑
   - 添加网络错误重试机制

5. **功能增强**
   - 添加数据缓存策略
   - 支持桌面通知
   - 添加数据过滤和搜索

## 调试技巧

### 查看后台脚本日志

1. 访问 `chrome://extensions/`
2. 找到本扩展，点击「service worker」
3. 打开 DevTools 查看 console 输出

### 查看 Popup 页面日志

1. 右键点击扩展图标
2. 选择「检查弹出内容」
3. 在 DevTools 中查看 console 输出

### 调试网络请求

在 DevTools 的 Network 标签页可以看到所有的 API 请求和响应。

## 常见问题

### Q: 提示「认证失败，请重新登录」？
A: 说明 Cookie 已过期，需要在浏览器中重新登录对应的系统。

### Q: 某个系统一直显示「待实现」？
A: 该系统的 API 调用代码还未实现，需要在 `background.js` 中补充。

### Q: 数据不更新？
A: 检查系统配置是否正确，或手动点击刷新按钮。

## 技术栈

- Chrome Extension Manifest V3
- 原生 JavaScript (无依赖)
- CSS3

## 版本历史

- **v1.0.0** (当前版本)
  - ✅ 基础框架搭建
  - ✅ 系统配置功能
  - ✅ 定时刷新机制
  - ⏳ API 调用待实现

## License

MIT
