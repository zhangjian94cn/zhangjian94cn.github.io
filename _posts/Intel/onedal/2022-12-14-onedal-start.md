---
title: "oneDAL Learning (1)"
subtitle: "getting started"
layout: post
author: "Zhang Jian"
header-style: text
mathjax: true
tags:
  - ML
  - oneDAL
---

## 简介

> 本文是对oneDAL的一个简单介绍，主要参考[onedal官方文档](https://oneapi-src.github.io/oneDAL/index.html)

oneDAL是一个高性能的数据分析库，其包含了数据分析的所有阶段（preprocessing, transformation, analysis, modeling, validation, and decision making）。oneDAL支持了批量、在线以及分布式的计算模式，其主要提供了两组C++接口：oneAPI/DAAL。

oneAPI Interfaces基于开放的[oneDAL规范（oneDAL specification）](https://spec.oneapi.com/versions/latest/elements/oneDAL/source/index.html)，目前正在积极开发中。它们可以在各种硬件上工作，但目前只提供了有限的算法。

DAAL Interfaces是仅限于CPU的接口，提供了各种算法的实现。

## 安装

### oneAPI

这里主要安装oneDAL需要的oneAPI依赖，包括intel-basekit intel-hpckit

```bash
apt-get install -y --no-install-recommends curl ca-certificates gpg-agent software-properties-common

# download the key to system keyring
wget -O- https://apt.repos.intel.com/intel-gpg-keys/GPG-PUB-KEY-INTEL-SW-PRODUCTS.PUB | gpg --dearmor | tee /usr/share/keyrings/oneapi-archive-keyring.gpg > /dev/null

# add signed entry to apt sources and configure the APT client to use Intel repository:
echo "deb [signed-by=/usr/share/keyrings/oneapi-archive-keyring.gpg] https://apt.repos.intel.com/oneapi all main" | tee /etc/apt/sources.list.d/oneAPI.list

apt update && apt install intel-basekit intel-hpckit -y

echo "source /opt/intel/oneapi/compiler/latest/env/vars.sh" >> ~/.bashrc
echo "source /opt/intel/oneapi/tbb/latest/env/vars.sh" >> ~/.bashrc
source ~/.bashrc
```

### oneDAL

如果想从源码编译oneDAL，官网提供了在不同系统环境下的[安装教程](https://github.com/oneapi-src/oneDAL/blob/master/INSTALL.md)


## 例程

由于oneDAL更新较快，本文本所使用的的commit hash为：`4b6d30b13b290a21c6263089ee0723cb29bcb9cf`，使用钱需切换到此commit下，使用如下命令

```bash
git checkout <commit-hash>
```

### 编译运行

oneDAL提供了两种方式编译example，使用cmake或者make。在这里，我们只编译基于daal接口的example。example目录为`<onedal_dir>/__release_lnx/daal/latest/examples/daal/cpp`，其代表了当前系统为linux，接口为daal，编程语言为cpp


#### 使用make

如果你已经添加了tbb，icc等的环境变量，那么可以直接make，就可以得到可执行文件。如果没有，你可以source相关的环境脚本：

```bash
source /opt/intel/oneapi/compiler/latest/env/vars.sh
source /opt/intel/oneapi/tbb/latest/env/vars.sh
```

#### 使用cmake

在使用cmake前，先设置cmake使用的编译器，在CMakeLists.txt下添加如下代码：

```cmake
SET(CMAKE_C_COMPILER "icc")
SET(CMAKE_CXX_COMPILER "icpc")
```

使用如下命令进行编译：

```bash
cd <onedal_dir>/__release_lnx/daal/latest/examples/daal/cpp
mkdir build && cd build
cmake .. -DEXAMPLES_LIST=<your example>
# for example: cmake .. -DEXAMPLES_LIST=gbt_cls_dense_batch
make -j$(nproc)
```

这样你就会在`_cmake_results/`下获得`<your example>`的可执行文件，


#### 依赖自己编译的oneDAL

直接编译，依赖的是/opt/intel/dal下的库，其不包含符号表信息，如果你想调用自己编译的onedal，可以按照如下步骤：

> onedal的example，在CMakeLists.txt中，主要通过`find_package(ONEDAL REQUIRED)`，找到onedal的lib。因此，需要生成`oneDALConfig.cmake`

1. source自己编译的onedal：
    ```bash
    # in your shell
    source <onedal_dir>/__release_lnx/daal/latest/env/vars.sh
    ```
2. 使用oneDAL提供的[脚本](https://github.com/oneapi-src/oneDAL/tree/master/cmake/scripts)生成`oneDALConfig.cmake`，位置如下：`<onedal_dir>/__release_lnx/daal/latest/lib/cmake/oneDAL`
3. 在CMakeLists.txt中添加对此cmake的依赖
    ```cmake
    set(oneDAL_DIR /workspace/oneDAL/__release_lnx/daal/latest/lib/cmake/oneDAL)
    ```
4. 运行之前的cmake编译指令即可


## 结语

本文带您了解了oneDAL的基本概念，并使用一个简单的示例进行编译和运行。然而，真正有趣的部分在于OneDAL的内部实现技巧和思想，敬请期待后续内容。



