---
title: "2023 Weekly-02 grouping"
layout: post
author: "Zhang Jian"
header-style: text
mathjax: true
tags:
  - work
  - weekly
---


## Summary

1. designed another two methods for dividing groups
2. implemented the three methods and two of them cannot converge
3. currently, the third method's sharing rate of gather operations is about 2


## Method

### 问题形式（Minimum set Cover）

<!-- $G = {g_1, g_2, ..., g_i}, g = {x_1, x_2, ..., x_n}, x \in (0, 1, ..., p)$, 
$S = {s_1, s_2, ..., s_j}, s = {y_1, y_2, ..., y_m}, y \in (0, 1, ..., q)$ -->

\begin{equation}
Minimize  |S|
\end{equation}

\begin{equation}
Subject \ to: \forall g_i \in G, \exists s_j \in S, g_i \subseteq s_j
\end{equation}

其中 `|S|` 表示集合 $S$ 的元素个数，$g_i \subseteq s_j$ 表示集合 $g_i$ 是集合 $s_j$ 的子集。

**主要使用贪心算法。基本思路是，每次选择覆盖最多未覆盖元素的集合，直到所有元素都被覆盖。**
<!-- 这种算法的时间复杂度是指数级别的，但在实际应用中经常能够得到较好的结果。 -->

### 算法框架

<!-- 1. 初始化：获得所有的group的feature index
    ```
    [
      tree1: [
        group1: [f1, f4, f6],
        group2: [f1, f3, f7],
        ···
      ],
      ...
    ]
    ```
2. 更新：
   1. 选取group set中的特征
   2. 删除被包含的group
3. 终止：
   1. 当group list为空时，结束
   2. 计算分享率 -->
```latex
# Initialization
- Get all feature index of groups
  groups = [
    tree1: [
      group1: [f1, f4, f6],
      group2: [f1, f3, f7],
      ···
    ],
    ...
  ]

# Main Loop
- Repeat until group list is empty:
  1. Select features from groups
  2. Remove groups that are included by the selected features

# Termination
- When group list is empty, the algorithm terminates
- Calculate sharing ratio
```

### 基于feature数量的分组方式

假设：feature所占的比例越高，包含这feature的$s$就能包含更多的$g$

实现：在`Select features from groups`步骤，选择最多的16个特征作为$s$，再删除掉被包含的$g$.


单棵树的特征分布

![](/img/20230112110329.png)  

所有树的特征分布

![](/img/20230112160941.png)  


### 基于group数量的分组方式

一种更合理的假设是：feature被越多的$g$所包含，那么包含这feature的$s$就能包含更多的$g$

$g$和feature的关系如下图所示：
![](/img/20230112171843.png)  


可视化group在feature上的分布，与之前按照数量的基本一致
![](/img/20230112111749.png)  

运行结果，无法收敛。
<img src="/img/20230112192145.png" width="400">

经过思考，发现其实此种划分方式的主要问题在于：经过几轮迭代后，可能会出现以下的情况。被最多$g$包含的feature组成的$s$，和任何一个$g$不相关

![](/img/20230112193130.png)  


### 基于group相似度的分组方式

基于以上问题，逆向思考，可以确定的是：每个$g$必然要被包含到某个$s$中，那么在同一个$s$中的$g$应当是相似的，通过选取一个$g$作为锚点，对所有的$g$按照相似度排序，将最相似的$g$的feature加入到$s$中，多次迭代之后得到$s$

\begin{equation}
similarity(g_1, g_2) = \frac{|g_1 \cap g_2|}{|g_1| + |g_2|}
\end{equation}

实际实现中，直接使用$g$的长度作为第二排序指标，目的是：每次尽可能加入少的feature到$s$中

```python
# 计算当前s的代码
while len(cur_set) <= 16:
    groups_sorted = sorted(groups, \
        key=lambda x:(cur_set.intersection(x), -len(x)), reverse=True)
    if len(cur_set.union(set(groups_sorted[0]))) > 16:
        break
    else:
        cur_set = cur_set.union(set(groups_sorted[0]))
    groups = [x for x in groups if not set(x).issubset(cur_set)]
```

结果如下：

<div>
<img src="/img/20230112195742.png" width = "300" alt="图片名称" align=left style="margin-right:50px"/>

<img src="/img/20230112195811.png" width = "300" alt="图片名称" align=right style="margin-right:50px"/>

<img src="/img/20230112201010.png" width = "300" alt="图片名称" align=right style="margin-right:50px"/>
</div >

<div style="float:None; clear: both;">
</div >


## Conclusion

目前的分享率较低需要进一步优化，可能的优化方向如下：

1. 考虑目前策略的参数与分享率的关系
2. 分区域进行sharing
3. 更优的dividing group策略

