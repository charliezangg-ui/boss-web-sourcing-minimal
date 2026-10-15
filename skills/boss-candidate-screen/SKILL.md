---
name: boss-candidate-screen
description: Review full BOSS resumes against a job-specific decision card, explicit exclusions, career path and direct responsibility evidence.
---
# 候选人匹配评审

每个岗位每批只建立一次判定卡：当前JD版本、用户已确认条件、2–3项核心长期责任、可迁移边界、硬排除与对应简历事实。JD和用户补充均需纳入；本包没有私有样本库，用户未提供的隐藏标准不能编造。正例、反例和边界例可由用户提供并按岗位版本保存；将用户明确原因与Agent推测分开。当前用户确认优先于旧判定卡，之后是当前JD；冲突需标明，不静默继承别岗要求。

候选人必须按[完整简历读取](references/resume-reading.md)足量覆盖。先按[排除集合](references/exclusion-policy.md)核对当前及历史经历，再按[逐关判断](references/decision-gates.md)评估职业主线、持续责任与本人项目行动。已确认硬排除命中即跳过，优势不抵消；路径不匹配需具体责任差异，不能按行业标签或“转AI晚”推断。现任大厂、学校、薪酬和技术词不证明owner责任。期望/最近关注薪资不是当前收入。可读但关键证据不足记 `insufficient_evidence`，与明确 `mismatch`、读取失败 `blocked_read` 分开。首次联系门槛不等同面试通过。

逐人保存匿名键、岗位卡与排除版本、各关status、至多3条决定性证据及来源、缺口、结论和详情覆盖；新证据复评保留原判断。只有全部必要关通过才 `contact_now` ；结果交回调用方，由[推荐页workflow](../boss-sourcing/references/workflows/recommendation-core.md)按任务衔接招呼或收藏。规则更新后旧contact_now必须按新版复核；已发送事实独立保存，不重发。

## 新岗位规则入口

开始候选人筛选前，按[规则生成与确认](references/role-rule-generation.md)准备或复用有效岗位规则；字段来源、确认和ready条件以该引用为准。
