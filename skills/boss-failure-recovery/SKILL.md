---
name: boss-failure-recovery
description: Diagnose and record BOSS web failures, bound recovery attempts and preserve unknown-write safety.
---
# 典型失败处理

遇错误先分只读/导航与发送/提交/下载等可能写入动作，保存预期结果、实际观察、身份、岗位、页面及同 run 断点。点击回执不代表业务成功。用最小 DOM 证据看目标、遮挡、加载及当前控制权；不足才补一张截图。导航故障诊断后最多恢复一次并核验；仍失败保留断点。单人读取失败记 blocked_read；同类故障在下一对象复现则暂停该读取流程，不能批量跳过。

前置失败立即终止依赖链：详情打开→同人详情就绪→截图→OCR→覆盖核验→评审；脚本用异常传播或明确返回值，不能无条件执行下游。未知写入冻结原事务，先在原会话或文件只读查证，不能重发/重下。登录、安全验证、付费和用户接管走对应边界，不作为普通点击重试。

每次错误实例写私有 `failure-events.jsonl`，同一故障重试/连带错误关联 event_id；可复用类型登记到[失败索引](references/failure-index.md)。索引保留症状、脱敏特征、confirmed/unknown 原因、proposed/verified/failed 恢复、成功条件与停止边界；新方案未实测就标 proposed，不把一次成功泛化为永久有效。每次纠错检查索引链接及授权冲突。按需用[人工复盘方法](references/weekly-review.md)归并实例和验证恢复；当前包不建立定时任务或外部投递。
