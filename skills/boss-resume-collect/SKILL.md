---
name: boss-resume-collect
description: Request, verify and optionally download an actual BOSS candidate resume, distinguishing each receipt stage.
---
# 收简历

单独查看已收到简历不授权主动索取；用户明确要求求简历，或本轮已授权跟进中的合适、有意向候选人，按[会话标准路径](../boss-conversation/SKILL.md)请求一次。请求前查既有消息、按钮状态、pending 与附件；话术和按钮分别 intent/回读。对方口头同意或说“已发”仅记承诺，不计收到。

只有同一会话出现可归属的完整附件或明确完整在线简历才记 `received_verified`，两种来源分列。已授权下载时先读当前浏览器工具的下载接口，从页面真实入口操作；确认本地文件存在、非空、写入稳定、类型合理，计算 SHA-256，绑定同候选人与岗位后计 `downloaded_verified`。超时先核对文件及原页面，不重按未知下载。多版本按哈希区分，保留原件，不执行附件代码或宏。岗位/身份冲突、附件不完整和本地写入 unknown 分别记录，不臆断收件成功。

本模块的终点是 BOSS 收件与私有本地文件核验；外部 ATS 或文件平台操作另由用户明确选择。
