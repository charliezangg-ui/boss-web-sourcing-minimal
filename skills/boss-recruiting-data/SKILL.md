---
name: boss-recruiting-data
description: Read BOSS recruiting metrics and reconcile them with verified run events without inventing missing counts.
---
# 查看招聘数据

读当前可见数据页、岗位页或会话统计，回读账号、岗位及日期过滤。每项保存指标名、数值、单位、时间范围、抓取时间、页面来源及平台可见定义。无权限/无指标记 unknown，不推断为0；取统计不得改变会话已读或发送消息。

本地执行漏斗来自[运营日志](../boss-operations-log/SKILL.md)和[事件账本](../boss-operations-log/references/operations-ledger.md)，与平台统计分列，不相加。人数、消息、附件数分别计；只在同一发送 cohort 内计算回复/收简历率，跨期回复按发生日及原发送 cohort 双重归属。分母为0记 N/A，缺同人关联只给阶段数，不报转化率。

按岗可汇总：实际寻访轮数、完整详情评审、可联系、新开聊、当日新回复、当日新开聊仍未回复、历史合格未回复存量、求简历、真实收到及下载。每项给来源和覆盖；缺历史记录明确 unknown，不把历史徽标或已有日报当当天活动。当前包只生成本地/当前任务结果，不自带定时投递。
