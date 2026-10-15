---
name: boss-sourcing
description: Route BOSS web recruiting to recommendation outreach, job creation, candidate favorites, conversation handling, optional Feishu Hire upload, or individual modules.
---

# BOSS 网页招聘索引

索引负责定位，workflow 负责组合，模块和失败索引负责具体规则。先读[网页契约](references/web-contract.md)，再加载本次任务所需流程与模块；同轮已读且未变化的内容复用。浏览器能力由用户环境提供，只操作已授权的招聘端网页。

## 常用流程

| 用户任务 | Workflow |
|---|---|
| 推荐页找合适候选人并打招呼 | [推荐招呼](references/workflows/recommendation-outreach.md) |
| 根据描述或JD创建岗位 | [创建岗位](references/workflows/job-create.md) |
| 推荐页找合适候选人并收藏 | [推荐收藏](references/workflows/recommend-favorite.md) |
| 沟通页面筛选与回复 | [会话处理](references/workflows/conversation-reply.md) |
| 将简历上传飞书招聘 | [简历上传](references/workflows/resume-upload.md) |

任务参数、动作授权和终点沿用用户要求及有效确认；调整与续跑按[编排契约](references/orchestration.md)处理。触达仍须模块的资格判断与同人发送回读。流程已有等价输入或结果时直接衔接相应步骤。

## 单项模块索引

| 能力 | 规则与执行入口 |
|---|---|
| 绑定或创建岗位 | [岗位](../boss-job-create/SKILL.md) |
| 设置筛选条件 | [筛选器](../boss-candidate-filter/SKILL.md) |
| 找人 | [寻访](../boss-candidate-source/SKILL.md) |
| 读完整在线简历 | [读取](../boss-candidate-read/SKILL.md) |
| 匹配评审及新岗位规则 | [评审](../boss-candidate-screen/SKILL.md) |
| 打招呼 | [触达](../boss-greet/SKILL.md) |
| 收藏 | [收藏](../boss-candidate-favorite/SKILL.md) |
| 沟通页编排 | [会话](../boss-conversation/SKILL.md) |
| 单人回复与跟进 | [跟进](../boss-candidate-followup/SKILL.md) |
| 求取或接收简历 | [收简历](../boss-resume-collect/SKILL.md) |
| 上传飞书招聘 | [上传](../feishu-hire-upload/SKILL.md) |
| 招聘数据 | [数据](../boss-recruiting-data/SKILL.md) |
| 失败处理 | [恢复](../boss-failure-recovery/SKILL.md) · [失败索引](../boss-failure-recovery/references/failure-index.md) |
| 安全验证反馈 | [安全反馈](../boss-security-feedback/SKILL.md) |

单项任务直接使用对应模块。筛选器设置、评审、收藏和招呼分别按任务动作执行。简历收件与已授权下载由收简历模块负责；上传飞书招聘时加载可选的独立上传模块，使用用户自己的连接与授权。

## 共享规则索引

- 浏览器、授权、写入及控制权：[网页契约](references/web-contract.md)。
- 目标、断点与跨模块恢复：[编排契约](references/orchestration.md)。
- 候选人交接、去重和计数：[候选人契约](references/candidate-contract.md)。
- 包内能力与验证范围：[迁移核对](../../MIGRATION-AUDIT.md)。离线校验不等于网页实测。
