# 收藏夹界面契约

星标输入是真实 browserState.currentUrl 和 title，不是地址栏草稿。hook 经现有 usePlatform 获取受控书签端口；Main 是唯一持久化所有者。
先订阅变更再读取列表，revision 较旧的快照丢弃。卸载后解除订阅，迟到读取不更新已卸载组件。
表单保存必须等待 Main 成功响应；失败时保留表单并展示安全错误，不显示原始异常或向日志输出 URL。
打开收藏前再次校验，当前标签复用原 openUrl；新标签复用父级现有 onOpenBrowserUrl，不创建另一套 webview。
敏感 query 必须用户明确勾选风险后才保存；编辑 URL 会撤销之前勾选。删除列表项必须确认。列表不请求 favicon。
