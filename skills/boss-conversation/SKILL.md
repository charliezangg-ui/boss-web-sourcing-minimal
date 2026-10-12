---
name: boss-conversation
description: Handle BOSS conversation UI one candidate at a time, including unread discovery, pending-transaction recovery and resume request steps.
---
# BOSS 候选人会话处理

每轮固定目标岗位、截止时间、动作授权与处理范围。一个会话通常代表一个候选人，但沟通岗位可能变更；核对上方岗位筛选器、会话岗位及岗位变更事件。先恢复本地已登记的同人同岗未完成事务，再发现新未读入站；已读状态不阻止精确恢复，但不扫描历史已读补量。列表打开前保存匿名键、岗位、未读数、时间、末条摘要和列表范围；摘要不当完整回复。打开会话核对身份、岗位、消息方向/时间线，候选人新消息按方向、时间、类型和规范化内容生成指纹去重。打开可能改已读，故检查点必须先存。[会话状态表](references/conversation-states.md)与[单人快速闭环](references/fast-path.md)按需读取。

新招呼：一级分流，必要时读完整详情并按岗位卡判断；明确不适合仅完成已读并记 `no_action_unfit`，不点击平台“不合适”自动发送拒绝；缺证或读取失败记 blocked_read，不当不适合。适合且有意向者回复实际问题，以完整简历为目标。主动打招呼后的会话：已读未回复/未读不催促；有入站时处理拒绝、询问、附件、联系方式或求简历意向。联系方式不是简历。涉及薪资承诺、融资、面试时间等公司决定时向当前用户升级，不代答。

每位候选人按检查点→读取→判断→授权动作→同会话回读→即时落盘→下一人串行。恢复状态为 `not_started/intent/verified/unknown/blocked`；仅确认未执行的步骤可续做。已请求但无附件记 `waiting_resume`，不重复请求。

## 标准话术与求简历按钮

标准话术：“你好，看了你的经历，和我们这个岗位有相关匹配点，想进一步了解。方便发一份完整简历吗？”仅用于当前岗位通过评审、属于授权跟进范围者。核对既有请求、附件和候选人意向。未请求过的合格候选人：先为 `resume_text` 写 intent，发送话术并回读；再为 `resume_button` 单独写 intent，点击当前会话“求简历”，确认弹窗后回读。两步独立存结果；控件不可用记 blocked，不用重复文本冒充按钮成功。任何一步 unknown 先查原会话，不重放。收到完整附件后交[收简历](../boss-resume-collect/SKILL.md)。
