---
name: boss-candidate-followup
description: Inspect new BOSS candidate replies, classify intent and resume state, and continue a recorded conversation without duplicate requests.
---

# 候选人回复与跟进

本模块处理一个已定位会话的入站分类与回复。[会话模块](../boss-conversation/SKILL.md)负责发现、岗位绑定、读取和逐人编排。直接收到批量“检查回复”任务时先进入会话模块；已有会话输入时复用其结果，不重新扫描列表。

输入：候选人键、岗位、完整会话证据、当前入站指纹、上次成功游标、评审结果、允许回复动作及原run。按候选人、岗位、入站指纹去重；只处理尚未完成的入站事务。末条为我方“送达”且无新入站时返回 `outbound_only`，不当作候选人回复。

## 入站分类与动作

- 问题或意向：按已授权且可核实的岗位事实回复；合格、有意向且未请求过简历时返回求简历下一动作，由会话模块执行其标准话术与按钮路径。
- 简历承诺：必要时确认接收，等待真实附件；承诺或系统提示不计收件。
- 真实附件：返回收件下一动作，交[收简历模块](../boss-resume-collect/SKILL.md)核验。
- 明确拒绝：记 `candidate_declined`，结束跟进，不执行平台拉黑或“不合适”。
- 联系方式：记录交换事实，不等于收到简历，也不授权跨渠道联系。
- 公司决策、薪资承诺、面试时间或未经授权的内部信息：记 `needs_user_decision`，按共享契约向用户升级。
- 语义不清或新增范围：保留待决定项；身份、岗位或读取异常交[失败模块](../boss-failure-recovery/SKILL.md)，不猜测。

回复前核验同人同岗、历史动作和当前内容授权，成功保存intent后才发送；随后回读同会话消息并立即落盘。写前落盘失败停止发送，unknown先核验、不重放。未回复者不自动催促，已有简历请求不重复发送。

## 返回结果

返回原事务、分类、回复状态、证据、下一动作及成功游标。会话模块归并 `checked_threads`、`new_inbound_threads`、`outbound_only`、`replied_verified`、`candidate_declined`、`resume_intent`、`resume_received_verified`、`needs_user_decision`、`reply_unknown` 与 `next_cursor`。模块返回不代表整个用户任务完成。

[回复页面观察](references/reply-surface.md)仅作历史控件线索，实际动作读取当前页面。
