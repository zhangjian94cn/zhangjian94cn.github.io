---
title: "Complete Group Tree and its Performance Analysis"
layout: post
author: "Zhang Jian"
header-style: text
mathjax: true
tags:
  - work
  - weekly
---

## tree structure 

### detail

下面时一个depth为3的tree，实际xgboost模型中，最后一层的leaf是不计入到depth中去的

![](/img/20221201152628.png)  

上周，此种tree时按照depth=4的方式进行存储，而当实际tree的depth=8时，此种存储方式就会出现结果上的错误。而实际xgboost训练时，会设置max_leaves，对于单棵tree来说，leaf是唯一的（和depth无关），因此因该进行独立的维护。

```cpp
private:
    std::vector<NodeGroup> _groups;
    std::vector<float> _leaf;
    int _depthN;
    int _depthG;
```

### result

depth = 8, 1k tree 在higgs数据集上的测试结果

**group tree**
![](/img/20221201154538.png)  

**xgboost**
![](/img/20221201154959.png)  


## speed optimization

经过一系列的实验，发现优化parallel的形式，可以一定程度上加速

### detail

使用2d的parallel

> The iteration space does not have to be linear. Look at oneapi/tbb/`blocked_range2d`.h for an example of a range that is two-dimensional. Its splitting constructor attempts to split the range along its longest axis. When used with `parallel_for`, it causes the loop to be “recursively blocked” in a way that improves cache usage. This nice cache behavior means that using `parallel_for` over a `blocked_range2d`<T> can make a loop run faster than the sequential equivalent, even on a single processor.

可视化的循环如下，需要注意的是：

1. 运行结果的存储，需要data_number*tree_number的空间吗？
2. 原先在串行1k tree number运行之后，需要经过sigmoid，parallel reduce?

![](/img/20221201161431.png)  


### solution

**1）仍然使用data_number的res，在并行过程中累加**

```cpp
tbb::parallel_for(
    tbb::blocked_range2d<size_t>(0, nT, 0, nD), 
    [&](const tbb::blocked_range2d<size_t>& r){
    
    for(size_t i = r.cols().begin(); i != r.cols().end(); i++) {
        for(size_t j = r.rows().begin(); j != r.rows().end(); j++) {
            for (int kD = 0 ;kD < nD; ++ kD) {
                for (int kT = 0 ;kT < nT; ++ kT) {
                    res[kD] += \
                        gbt._trees[kT].predictTree(data + kD * featDim);
                }
            }
        }
    }
});
```

**2）使用parallel_for进行sigmoid处理**

```cpp

tbb::parallel_for(0, nD, 1, [&](int i) {
    for (int j = 0 ;j < nD; j++) {
        res[j] = sigmoid(res[j]);
    }
});
```

## memory access

### vtune analysis

```
Memory Bound: 65.3% of Pipeline Slots
    | The metric value is high. This may indicate that a significant fraction
    | of execution pipeline slots could be stalled due to demand memory load
    | and stores. Explore the metric breakdown by memory hierarchy, memory
    | bandwidth information, and correlation by memory objects.
    |
    L1 Bound: 61.6% of Clockticks
        | This metric shows how often machine was stalled without missing the
        | L1 data cache. The L1 cache typically has the shortest latency.
        | However, in certain cases like loads blocked on older stores, a load
        | might suffer a high latency even though it is being satisfied by the
        | L1.
        |
    L2 Bound: 11.8% of Clockticks
        | This metric shows how often machine was stalled on L2 cache. Avoiding
        | cache misses (L1 misses/L2 hits) will improve the latency and
        | increase performance.
        |
    L3 Bound: 5.5% of Clockticks
        | This metric shows how often CPU was stalled on L3 cache, or contended
        | with a sibling Core. Avoiding cache misses (L2 misses/L3 hits)
        | improves the latency and increases performance.
        |
    DRAM Bound: 0.0% of Clockticks
        Memory Bandwidth: 1.2% of Clockticks
    Store Bound: 0.0% of Clockticks
    NUMA: % of Remote Accesses: 0.0%
Loads: 1,212,135,628
Stores: 379,910,926
LLC Miss Count: 0
    Local DRAM Access Count: 0
    Remote DRAM Access Count: 0
    Remote Cache Access Count: 0
Average Latency (cycles): 25
Total Thread Count: 145
Paused Time: 0s

```

### optimization


1. 修改算法, 减小数据存取
2. 可能存在频繁的**缓存切换**问题（未进行对齐）
3. 使用cache line替换分析


## Next

1. continue to optimize current version
2. figure out onedal's optimization
3. compare ours method and onedal's method



