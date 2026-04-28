# 配置（可导入/导出 JSON）

本工具的配置分为 **公共配置（public）** 与 **私人配置（private）** 两份，最终运行时会合并得到“有效配置”。

## 合并规则（v1）

- **默认**：`public -> private` 合并，private 覆盖 public。
- **快捷键（hotkeys）**：可以选择来源：
  - `public`：完全使用公共快捷键
  - `private`：完全使用私人快捷键
  - `merge`：public 为底，private 覆盖（默认）

## JSON 导入/导出

- 导出时保存一个 **ConfigBundle**，包含 `publicConfig` + `privateConfig` + `moduleSources`。
- 导入时会覆盖当前 bundle（并做字段兼容/缺省填充）。

## 路径组与目录权限（重要）

设置中的 “DDS/Copybook 路径组”：

- **路径字符串**会进入 JSON 配置，便于分享/同步。
- **实际解析所需的目录句柄（Directory Handle）**不会进入 JSON（浏览器安全限制），会单独存到 IndexedDB。
- 因此：在新机器或清理浏览器数据后，需要重新点「选择…」授权目录，才能再次解析。

