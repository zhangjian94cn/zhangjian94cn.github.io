---
title: "Complete Group Tree and its Performance Analysis"
layout: post
author: "Zhang Jian"
header-style: text
mathjax: true
tags:
  - work
---

## 



## Multithreading

### OpenMP

Use openmp to parallel gbt prediction

```cpp
for (int k = 0; k < 100; ++ k) {
    #pragma omp parallel for
    for (int i = 0; i < dataDim; ++ i) {
        res[i] = gbt.predictGBT(data + i * featDim);
    }
}
```

![](/img/20221123164508.png)  



### TBB

Use tbb to parallel gbt prediction

```cpp
for (int k = 0; k < 100; ++ k) {
    tbb::parallel_for(0, dataDim, 1, [&](int i) {
            res[i] = gbt.predictGBT(data + i * featDim);
    });
}
```

![](/img/20221123165924.png)  



## Performance Snapshot


### group tree

```bash
Elapsed Time:	15.470s
    IPC:	0.461
    SP GFLOPS:	3.225
    DP GFLOPS:	0.068
    x87 GFLOPS:	0.000
    Average CPU Frequency:	2.9 GHz

Logical Core Utilization:	93.7% (134.952 out of 144)
    Physical Core Utilization:	93.7% (67.489 out of 72)

Microarchitecture Usage:	20.0% of Pipeline Slots
    Retiring:	20.0%
    Front-End Bound:	8.3%
    Bad Speculation:	0.0%
    Back-End Bound:	76.7%
    Memory Bound:	56.8%

```

### xgboost

```bash
Elapsed Time:	197.096s
    IPC:	0.914
    SP GFLOPS:	2.391
    DP GFLOPS:	0.033
    x87 GFLOPS:	0.000
    Average CPU Frequency:	3.0 GHz

Logical Core Utilization:	98.6% (141.958 out of 144)
    Physical Core Utilization:	98.6% (71.001 out of 72)

Microarchitecture Usage:	38.7% of Pipeline Slots
    Retiring:	38.7%
    Front-End Bound:	19.7%
    Bad Speculation:	0.0%
    Back-End Bound:	49.2%
    Memory Bound:	15.6%
    Core Bound:	33.6%
```


### onedal

```bash

Elapsed Time:	115.541s
    IPC:	2.514
    SP GFLOPS:	6.293
    DP GFLOPS:	0.000
    x87 GFLOPS:	0.000
    Average CPU Frequency:	2.8 GHz

Logical Core Utilization:	47.0% (67.721 out of 144)
    Physical Core Utilization:	89.5% (64.415 out of 72)

Microarchitecture Usage:	62.8% of Pipeline Slots
    Retiring:	62.8%
    Front-End Bound:	5.2%
    Bad Speculation:	0.0%
    Back-End Bound:	32.1%
    Memory Bound:	14.0%
    Core Bound:	18.1%
```

