---
name: boss-operations-log
description: Enforce per-candidate BOSS run event logging, strategy versions, stage timings and accurate completion counts.
---
# 招聘运营日志

输入 run_id、原目标、模块事件、统计期间和私有运行目录。日指标与回填口径见[事件账本](references/operations-ledger.md)。以 event_id 归并、candidate_key 去重；历史汇总缺同人证据则列未验证。开始首位候选人前持久化岗位/JD与判定卡版本、授权、原目标、完整实际筛选条件、strategy_id、开始时间。切页、刷新或改条件先追加[策略事件](../boss-candidate-source/references/strategy-ledger.md)，再处理候选人。

每人进入时写匿名键、一级卡片位置和阶段开始时间；每一阶段结束立刻写时间、状态、结果及证据引用：卡片、详情/折叠、评审、发送/回读、会话、收简历、日志。批量读取耗时单列，不伪造逐人分摊。进入下一人前核对必填事件已写且可读；落盘失败保存最小断点并先修复，不能继续累积未记录外部写入。缺失时间用 null 与原因，不以0或文件 mtime 倒推。

同一 run 更新同份 `operations.md`，事件追加到私有 JSONL；发送、回复、简历请求、真实收到、下载均独立事件。状态 unknown 与成功分列。每次切页/放宽/暂停续接重算原目标、唯一合格发送及剩余量；计数不一致、提前收尾或记录缺口进入[失败日志](../boss-failure-recovery/SKILL.md)。完成输出卡片数、详情数、有效招呼数、各阶段覆盖率、耗时与缺失范围。日志保存本身不证明招聘完成。
