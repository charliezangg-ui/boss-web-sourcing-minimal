# 推荐页共用组合

输入：目标岗位、当前规则引用、任务范围与目标、允许的末端动作、原run及断点。复用[共享契约](../web-contract.md)和[候选人交接](../candidate-contract.md)；按已有结果恢复，不逐人重读流程。

1. 由[评审模块](../../../boss-candidate-screen/SKILL.md)准备或复用当前岗位上下文，再由[筛选模块](../../../boss-candidate-filter/SKILL.md)设置并回读实际条件。规则与岗位不变时复用材料，页面绑定和条件状态仍现场核验。
2. [寻访模块](../../../boss-candidate-source/SKILL.md)返回去重候选人、卡片分流与位置。需要详情的对象交[读取模块](../../../boss-candidate-read/SKILL.md)，再将足量材料交评审模块；已有同版本有效结果直接复用。
3. 将评审结果交给当前workflow指定的招呼或收藏模块。资格、授权和成功条件由动作模块校验；未进入动作的对象保存评审结果。
4. 按[候选人交接](../candidate-contract.md)保存本人的结果与断点，再继续同一任务。目标和续接按[编排契约](../orchestration.md)处理。

操作失败交[失败模块与索引](../../../boss-failure-recovery/SKILL.md)；读取失败不作为候选人缺证结论。恢复后从返回的断点继续，不重放未知写入。
