---
title: "oneDAL"
subtitle: "getting started"
layout: post
author: "Zhang Jian"
header-style: text
mathjax: true
tags:
  - ml
---

## 简介

> 本文是对oneDAL的一个简单介绍

[oneDAL](https://oneapi-src.github.io/oneDAL/)是一个高性能的数据分析库，其包含了数据分析的所有阶段（preprocessing, transformation, analysis, modeling, validation, and decision making）。oneDAL支持了批量、在线以及分布式的计算模式，其主要提供了两组C++接口：oneAPI/DAAL。

## 安装

官网提供了在不同系统环境下的[安装教程](https://github.com/oneapi-src/oneDAL/blob/master/INSTALL.md)


## 例程

### 编译运行

1. add Cmakelist.txt
    
    ```cmake
    list(APPEND EXAMPLES gbt_cls_dense_batch)

    add_examples(${EXAMPLES})
    ```

2. cd `/oneDAL/examples/daal/cpp/` and run cmake

3. 生成可执行文件：`_cmake_results/**`

4. 运行结果
    ![](/img/20221215212453.png)  


### config debug

直接编译，依赖的是/opt/intel/dal下的库，其不包含符号表信息，因此需调用自己编译的onedal，并且设置相关依赖。

onenote的文档，通过设置DALROOT路径，配置了daal4py的自定义依赖。而onedal的example，经研究，其主要通过`find_package(ONEDAL REQUIRED)`，找到onedal的lib。因此，需要生成`oneDALConfig.cmake`

发现，onedal中提供了生成`oneDALConfig.cmake`的脚本，生成后，即可获得cmake文件。

<img src="/img/20221215213759.png" width = "250" alt="图片名称" align=left style="margin-right:50px"/>

<div style="float:None; clear: both;">
</div >

在cmakelist.txt中添加对此cmake的依赖，即可成功编译

```cmake
set(oneDAL_DIR /workspace/oneDAL/__release_lnx/daal/latest/lib/cmake/oneDAL)
```




