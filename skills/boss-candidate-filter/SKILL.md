---
name: boss-candidate-filter
description: Plan, apply and verify BOSS candidate filters separately for recommendation and search pages.
---
# 设置候选人筛选条件

输入：已核验岗位、页面入口、用户明确条件、JD中真正必要条件。先读取现有筛选器和当前可选项；推荐/精选/最新与搜索人才库的字段、保存方式不同。参考[推荐筛选器目录](references/filter-catalog.md)和[搜索筛选器目录](references/search-filter-catalog.md)，它们是历史 UI 线索，不证明当前页面相同。

建立逐字段计划：字段、目标值、来源（用户/JD/推断）、当前页面支持与实际档位。薪资、经验、学历、学校、第一学历、城市、活跃度、关键词、专业、近期查看与同事交换等均按本轮确认值；本包没有固定的本科/985/50K默认值。岗位发布薪资与年限不自动变成候选人筛选条件。年龄、性别、家庭等非工作属性不设过滤。JD仅加分项不强制缩窄；平台不能精确表达则保留较宽范围并报告偏差。

新的按岗寻访开始前，一次性列出完整条件及平台档位偏差；缺少会改变边界的薪资或经验值时一次问清。本轮已有明确值直接复用，续跑和窄转宽不重复询问。面板操作串行：设值→按页面要求提交→重开/回读每项 effective 值、岗位和城市。推荐页“确定”、搜索页即时勾选和专业弹窗确认不可混淆；列表变化、筛选数量徽标不能代替逐字段回读。刷新或切岗位后重新核对，不假定旧条件仍在。

输出字段表：requested/effective/unsupported/failed/unknown、页面、时间、证据与偏差。条件未知不得把该列表计入原策略样本。低产出阶段按[策略顺序](references/search-strategy.md)调整，只放宽获准的召回项，不改变真实岗位门槛。
