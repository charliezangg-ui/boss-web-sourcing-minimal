# 招聘运营事件账本与日指标

每人、消息、附件或平台写动作完成回读后立即向私有 `operations/YYYY-MM-DD.jsonl` 追加，日期按用户指定时区的事件发生时间。外部写入先 intent、后 verified/blocked/unknown；稳定 event_id 去重。字段至少有 event_id、occurred_at、run_id、module、role_ref、匿名 candidate_key、action、status、evidence_ref、criteria_version、匿名 conversation_ref、source_run。发送、回复、求简历、真实收到和下载分别记，不能合成一个状态。

按岗位/日统计：sourcing_runs、discovered_unique、detail_reviewed_unique、qualified_unique、greeted_verified_unique、followup_replied_verified_unique、candidate_replied_today_unique、qualified_no_reply_new_cohort、qualified_no_reply_stock、resume_requested_verified、resume_received_verified、downloaded_verified，以及 send_unknown、write_unknown、blocked、historical_unqualified_send。今日回复按回复发生日统计，不论开聊日；回复率仅在同一发送 cohort 内计算，展示 cohort 日期、已回复人数、发送人数和观察截止时间。日回复数除日招呼数不是有效回复率。

本地报告分总览、按岗位、回复/简历、质量/异常与下一步；数字只来自已验证事件，缺失写 unknown。首次启用或某日账本缺失，可从同日 run state、候选人事件和同人发送前后证据做一次 `verified_backfill`：只有能还原岗位、匿名对象、动作、时间和验证状态的才回填；历史汇总、按钮或徽标不能拆成事件。回填保留原 run_id、稳定 event_id 和证据引用。报告生成后回读文件，本包不向外部 IM 投递。
