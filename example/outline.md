# Git 不是魔法：先看懂历史怎么走

受众：知道基本 Git 命令、希望理解分支与合并的工程师。时长：约 8–10 分钟。形式：中文现场分享，也可按 S 查看讲者备注。所有图解使用 A、B、C、D 等合成标识，不是生产项目数据。七套主题共用 `example/_source/index.html` 的内容、步数和版式。

## 01 · Git 不是魔法，先看懂历史怎么走

证据：合成的分支与合并关系图。
点击：第 0 步呈现标题、承诺与图解。
备注：从对象、指针讲到协作；不是 Gitflow 的 release/develop 分支规范。

## 02 · 四种对象，各管一件事

证据：blob / tree / commit / tag 四卡。
点击：第 1–4 步依次揭示对象，讲过的压暗。
备注：区分附注标签与轻量标签；根提交无父提交，合并提交可有多个父提交。

## 03 · 提交指向快照，差异按需计算

证据：commit → tree → blob，文件名写在 tree 到 blob 的关系旁。
点击：第 0 步图解；第 1 步说明未变内容可复用。
备注：逻辑快照不等于磁盘完整复制；底层 pack 可能使用差量压缩。

## 04 · 新建分支，只增加一个指针

证据：main 和 feature 指向同一个 B；命令 `git switch -c feature`。
点击：第 0 步提交关系；第 1 步 main；第 2 步 feature、HEAD 和命令。
备注：HEAD 指向分支是正常附着状态，detached HEAD 除外。

## 05 · 分叉之后，merge 保留两条来路

证据：C 与 D 已分叉，合并产生有两个父提交的 M。
点击：第 0 步分叉；第 1 步合并节点和 main 的新位置。
备注：这是非快进合并；fast-forward 不必产生新提交。

## 06 · rebase 重放改动，形成新的提交

证据：D 的改动应用在 C 后面，生成新的 D′。
点击：第 0 步原历史；第 1 步 D′ 出现，原 D 改为虚线。
备注：前提是改动成功重放且非空；旧提交并非立即消失。

## 07 · 先约定历史，再选择整合方式

证据：merge / rebase 两行对照表。
点击：第 0 步表格；第 1、2 步分别点亮一行。
备注：共享历史不应擅自改写；两种方式的最终文件内容不保证总是相同。

## 08 · 它新增了什么对象，又把哪个指针移到了哪里？

证据：可用于解释命令的两个问题。
点击：第 0 步问题；第 1 步行动。
备注：尝试 `git cat-file -p HEAD` 与 `git log --oneline --graph`。

## 事实依据

以下资料用于核对机制，图形与文案为独立整理，未使用原书图片。

- [Pro Git：Git Objects](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects)
- [Pro Git：Branches in a Nutshell](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell)
- [Pro Git：Basic Branching and Merging](https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging)
- [Pro Git：Rebasing](https://git-scm.com/book/en/v2/Git-Branching-Rebasing)
