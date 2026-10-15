# 沟通页筛选与回复

Workflow ID：`conversation_reply`。

将岗位、会话范围、动作授权和原run断点交给[boss-conversation](../../../boss-conversation/SKILL.md)。直接使用其已有的发现、读取、评审、单人回复和收件编排；会话规则与恢复方式不在本流程重写。

接收会话处理结果、未完成事务和下一游标，记录到原run。已收简历与下载结果由[收简历模块](../../../boss-resume-collect/SKILL.md)交付。
