---
name: boss-candidate-followup
description: Inspect new BOSS candidate replies, classify intent and resume state, and continue a recorded conversation without duplicate requests.
---
# 候选人回复与跟进

输入岗位范围、上一成功游标、允许回复动作及本地待办。默认单次检查；本包不建立后台监听。先恢复精确待办，再在目标岗位“未读”发现新入站；打开前保存列表检查点。`[送达]` 等我方末条且无未读只记 `outbound_only`；候选人回复、附件意向、系统事件和截断摘要须打开同会话核验。按 `candidate_key + job_ref + inbound_fingerprint` 去重，不把完整聊天正文复制到批量日志。

分类：未回复、问题/意向、拒绝、简历承诺、真实附件、联系方式、需要用户决定、读取或身份阻塞。问题可在已授权的真实岗位事实内回答；有意向且合格、未请求过简历者按[会话模块](../boss-conversation/SKILL.md)执行标准话术＋按钮。候选人说愿意发简历时可确认接收并等待真实附件，不把系统提示或口头“已发”计作收件。明确拒绝后记 `candidate_declined` 并结束跟进，不催促未回复者或执行平台拉黑。语义不清、身份/岗位冲突或需要新外发范围记 `needs_user_decision`。真实附件进入[收简历](../boss-resume-collect/SKILL.md)。回复前 intent，发送后回读，unknown 先核验。输出 checked_threads、new_inbound_threads、outbound_only、replied_verified、candidate_declined、resume_intent、resume_received_verified、needs_user_decision、reply_unknown 与 next_cursor；未回复不计闭环成功。本轮仅处理截止检查点内的入站，之后的新消息留下一轮。

[回复页面观察](references/reply-surface.md)仅作历史控件线索，实际动作需重读当前页面。
