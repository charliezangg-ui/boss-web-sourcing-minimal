---
name: boss-sourcing
description: Route modular BOSS web recruiting from job binding through sourcing, screening, greeting, conversations, resume receipt and recovery.
---

# BOSS 网页招聘总入口

仅操作当前已授权的 BOSS 招聘端网页。先读[网页契约](references/web-contract.md)，再按任务加载模块。浏览器能力由用户环境提供，Ego Lite 可作为独立浏览器选择；不假定装有本项目外的私有配置。

| 请求 | 模块 | 完成证据 |
|---|---|---|
| 绑定或创建岗位 | [岗位](../boss-job-create/SKILL.md) | 同名同城 JD、保存与在招状态分别回读 |
| 设置筛选条件 | [筛选器](../boss-candidate-filter/SKILL.md) | 每项请求值、实际值和偏差 |
| 找人 | [寻访](../boss-candidate-source/SKILL.md) | 实际读过的唯一一级卡片与详情人数 |
| 读完整在线简历 | [读取](../boss-candidate-read/SKILL.md) | 全文覆盖、折叠补读及缺口 |
| 判断能否联系 | [评审](../boss-candidate-screen/SKILL.md) | 岗位卡、逐关证据及版本 |
| 打招呼 | [触达](../boss-greet/SKILL.md) | 同人同岗发送回读 |
| 处理会话 | [会话](../boss-conversation/SKILL.md)、[跟进](../boss-candidate-followup/SKILL.md) | 入站指纹、逐人动作及终态 |
| 求取或接收简历 | [收简历](../boss-resume-collect/SKILL.md) | 话术、求简历按钮、附件及下载分别核验 |
| 数据与留痕 | [数据](../boss-recruiting-data/SKILL.md)、[日志](../boss-operations-log/SKILL.md) | 阶段计数、策略版本及覆盖率 |
| 失败与安全验证 | [恢复](../boss-failure-recovery/SKILL.md)、[安全反馈](../boss-security-feedback/SKILL.md) | 原运行断点、故障状态、恢复证据 |

“找人并打招呼 N 人”按岗位绑定→条件回读→一级分流→完整读取→逐关评审→发送回读循环，仅同人同岗、合格且已验证的唯一发送计入 N。“筛选 N 人”止于评审，不隐含外发。“处理新招呼”检查未读及本地未完成事务；合适者的目标是取得完整简历，不合适者记录已读事实。收到附件仅完成 BOSS 收件及已授权下载，后续去向由用户另行决定。

数量目标、断点和续接遵循[编排契约](references/orchestration.md)；[候选人交接与量化](references/candidate-contract.md)统一计算人数、事件与未知值。模块可独立调用，跳过上游须有等价证据；触达不能跳过资格评审。达标或用户明确终点后封存运行；事后发现误发只更正质量记录，不自动补量。

## 新岗位规则入口

新岗位先按[规则 JSON 生成与确认](../boss-candidate-screen/references/role-rule-generation.md)自动生成完整结构；剩余可比较选项默认最严格，已确认决定与例外保留。薪资、年限仍须用户确认；规则 ready 且动作已获授权后才进入执行。同一运行续跑复用确认与规则版本。
