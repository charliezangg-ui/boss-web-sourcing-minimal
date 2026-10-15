# 推荐收藏

Workflow ID：`recommend_favorite`。

将岗位、任务范围、目标及收藏授权交给[推荐页共用组合](recommendation-core.md)，末端动作使用[boss-candidate-favorite](../../../boss-candidate-favorite/SKILL.md)。复用当前评审结果，保存同人同岗的收藏回读。

由收藏模块分别返回新增、已存在、未知及阻塞结果，按用户任务的统计范围判断完成。是否接续其他动作由任务决定。
