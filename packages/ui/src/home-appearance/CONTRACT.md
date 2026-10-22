# HSCode 首页背景

仅外观设置和新任务首页消费公开 contract。唯一持久化所有者是当前 profile 的 localStorage；React useSyncExternalStore 只持有投影。不使用 Host、Agent、远程广播或网络上传。

保存仅接受有限长 JPEG/PNG/WebP base64 data URL 或 null；文件导入经过体积、像素限制和 Canvas JPEG 重编码，最长边 1600，移除原始元数据。读失败/非法值返回 null；写失败不派发变更，不覆盖旧值。照片既不写日志，也不发送到模型。

写入成功后发本窗口事件；其他窗口监听原生 storage。无定时轮询、无第二份图片缓存。异步选择以请求序号 latest-wins；移除撤销未完成解码的写入资格。设置卸载后的迟到结果忽略。背景只在 SessionPane 草稿可见时挂载，pointer-events:none；聊天和代码不铺图。
