# 手工 / Playwright 测试清单

在 `npm run dev` 启动后，用浏览器打开 Vite 本地地址（若 5173 占用则可能是 **http://localhost:5174/**）。

本次 **user-playwright MCP** 已于 2026-04-26 对 **http://localhost:5174/** 跑过一轮快照与点击。

## 界面与菜单

- [√] 测试页面标题与顶栏「SQL Web Tool」可见
- [√] 测试 File / Settings 菜单可点击（Settings 展开含「打开设置…」）
- [√] 测试顶栏按钮文案为「复制」（非「执行」）

## 设置

- [√] 测试 Settings → 打开设置后弹窗与分组手风琴可见（1.基础设置～5.JSON）
- [√] 测试「1. 基础设置」主题下拉可选 Dark / Light（MCP 已选 Light 预览）

## 编辑区与搜索

- [√] 测试左侧搜索框与表/字段列表存在
- [√] 测试 Monaco 编辑区加载完成（「Editor content」与 SQL 行可见）

## 复制

- [√] 测试点击「复制」无 `alert`（关闭设置弹窗后点击，无阻塞弹窗）
- [ ] 测试剪贴板内容等于格式化后 SQL（需 HTTPS 或 localhost 权限，自动化未断言剪贴板）

## 数据文件（仓库 test/）

- [√] 测试 `test/dds` 与 `test/cpy` 下存在成对 ORDHDR / ORDDTL / CUSTMAS（.dds + .cbl）

## 控制台

- [√] 测试无影响功能的控制台错误（已用 `index.html` 空 favicon 避免 404）
