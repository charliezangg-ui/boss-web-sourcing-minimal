# 策略版本与过程数据

每次寻访在私有运行目录保存 `strategy-events.jsonl`：唯一 strategy_id、parent_strategy_id、run_id、岗位/JD/判定卡版本、实际时间、surface（推荐/最新/搜索/精选）、页面代数、requested_filters、effective_filters及回读证据、切换原因、剩余目标、switch_count、refresh_count。所有实际字段逐项记录；不支持写 unsupported，不明写 unknown。相同条件切最新也生成版本并注明条件未变。开始窗口前记录 window_size、decline_rule、baseline_strategy_id；暂定判据标 experimental，不能事后按结果改。

每人写 candidate_key、strategy_id、入口、列表位置、页面批次、观察时间。只有实际读取内容才记 card_observed；打开前冻结一级结论与依据。跨页重复单列，同 run 唯一计数只增一次，同时保留 first_seen_strategy_id/evaluated_strategy_id。卡片读取、一级、详情、正文DOM/截图/OCR/折叠、二级、发送与回读、会话、简历请求/收件、落盘各记 started_at、ended_at、monotonic_duration_ms、status、attempt_id、evidence_ref。共享批处理时间用 batch_id，不伪装个人耗时；等待、恢复重试、调试单列。token 未采集留 null，不按截图数猜。

每人终态立即追加并更新 state，再进下一人。缺计量记 failure 与 missing_reason，先修复后继续外部写入，不回开已读或重发补历史。按岗位×策略×页面汇总实际卡片、重复、一级三类、详情、可评审、合格、已验证发送、读失败、跳过和耗时。可评审分母排除纯重复、纯一级跳过与 blocked_read。回复率按发送 cohort 和截止时间，不混成评审通过率；页面与筛选同时变化是混杂因素，不做因果提速结论。mtime 不当执行时间，历史估算标 estimated 且不覆盖原始记录。
