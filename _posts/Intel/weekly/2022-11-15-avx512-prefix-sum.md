---
title: "AVX512 Prefix Sum"
layout: post
author: "Liang Yuliang"
header-style: text
mathjax: true
tags:
  - avx
  - hpc
  - work
---

## 方案
hist切分过程中，切分点左右的bin需要分别做累加，得到的梯度和用于分别计算左右子树的增益。为了加速计算，算法采用累积左侧bin结果，当前累积结果保存在一个浮点数中，每次循环累积一次计算一次gain。这种前缀累加模式可以使用向量化指令一次性计算所有前缀和，典型实现如[Prefix Sum with SIMD](https://en.algorithmica.org/hpc/algorithms/prefix/)算法。

## 代码
```c++
template<Mode mode = Mode::InPlace>
void roll(float* base_addr, float* result, int LEN, int N) {
    float *base_addr_copy = base_addr;
    float *result_copy = result;
    std::random_device rd;
    std::default_random_engine e(rd());
    std::uniform_int_distribution<unsigned> rindex(0, N-1);
    for (int i = 0; i < N; i++) {
        result[0] = base_addr[0];
        for (int j = 1; j < LEN; j++) {    
            result[j] = result[j-1] + base_addr[j];
        }
        if (mode == Mode::Order) {
            result += LEN;
            base_addr += LEN;
        } else if (mode == Mode::Random) {
            int offset = rindex(e);
            result = offset * LEN + result_copy;
            base_addr = offset * LEN + base_addr_copy;
        } else {
            continue;
        }
    }
}
```
```c++
template<Mode mode = Mode::InPlace, AVX avx = AVX::AVX512>
void vectorization(float* base_addr, float* result, int LEN, int N) {
    float *prefix = (float*)aligned_alloc(64, LEN * sizeof(float));
    float *base_addr_copy = base_addr;
    float *result_copy = result;
    std::random_device rd;
    std::default_random_engine e(rd());
    std::uniform_int_distribution<unsigned> rindex(0, N-1);
    for (int i = 0; i < N; i++) {
        if (avx == AVX::AVX512) {
            for (unsigned int j = 0; j < LEN/(sizeof(__m512)/sizeof(float)) ; j += 1) {
                *((__m512*)(result) + j) = _mm512_add_ps(*((__m512*)(base_addr) + j), (__m512)_mm512_bslli_epi128(*((__m512i*)(base_addr) + j), 4));
                *((__m512*)(result) + j) = _mm512_add_ps(*((__m512*)(result) + j), (__m512)_mm512_bslli_epi128(*((__m512i*)(result) + j), 8));
            }
            int j = sizeof(__m512)/sizeof(float);
            for (; j < LEN; j += (sizeof(__m512)/sizeof(float))) {
                prefix[j-12] = prefix[j-16] + result[j-13];
                prefix[j-8] = prefix[j-12] + result[j-9];
                prefix[j-4] = prefix[j-8] + result[j-5];
                prefix[j] = prefix[j-4] + result[j-1];
            }
            {
                prefix[j-12] = prefix[j-16] + result[j-13];
                prefix[j-8] = prefix[j-12] + result[j-9];
                prefix[j-4] = prefix[j-8] + result[j-5];
            }
            for (int j = 0; j < LEN; j += sizeof(__m512)/sizeof(float)) {
                *((__m512*)(prefix+j)) = _mm512_set_ps(
                    prefix[j+12], prefix[j+12], prefix[j+12], prefix[j+12],
                    prefix[j+8], prefix[j+8], prefix[j+8], prefix[j+8],
                    prefix[j+4], prefix[j+4], prefix[j+4], prefix[j+4], 
                    prefix[j], prefix[j], prefix[j], prefix[j]
                );
            }
        } else {
            for (unsigned int j = 0; j < LEN/(sizeof(__m256)/sizeof(float)) ; j += 1) {
                *((__m256*)(result) + j) = _mm256_add_ps(*((__m256*)(base_addr) + j), (__m256)_mm256_slli_si256(*((__m256i*)(base_addr) + j), 4));
                *((__m256*)(result) + j) = _mm256_add_ps(*((__m256*)(result) + j), (__m256)_mm256_slli_si256(*((__m256i*)(result) + j), 8));
            }
            for (int j = sizeof(__m128)/sizeof(float); j < LEN; j += sizeof(__m128)/sizeof(float)) {
                prefix[j] = prefix[j-4] + result[j-1];
                *((__m128*)(prefix+j)) = _mm_set1_ps(prefix[j]);
            }
        }

        for (unsigned int j = 0; j < LEN/(sizeof(__m512)/sizeof(float)); j += 1) {
            *((__m512*)(result) + j) = _mm512_add_ps(*((__m512*)(result) + j), *((__m512*)(prefix) + j));
        }

        if (mode == Mode::Order) {
            result += LEN;
            base_addr += LEN;
        } else if (mode == Mode::Random) {
            int offset = rindex(e);
            result = offset * LEN + result_copy;
            base_addr = offset * LEN + base_addr_copy;
        } else {
            continue;
        }
    }
}
```
## 结果
11th Gen Intel(R) Core(TM) i7-1165G7 @ 2.80GHz @Tigerlake @g++-11.2.0
g++ --std=c++11 -mavx512f -mavx512bw -O3

||InPlace|Order|Random|
|-|-|-|-|
|roll|199.388|412.46|668.671|
|AVX256|155.442|356.555|598.742|
|AVX512|90.468|308.339|593.526|

11th Gen Intel(R) Core(TM) i7-1165G7 @ 2.80GHz @Tigerlake @icc-2021.7.0
icc -diag-disable=10441 -std=c++11 -mavx512f -mavx512bw -O3

||InPlace|Order|Random|
|-|-|-|-|
|roll|198.274|410.039|661.097|
|AVX256|158.463|353.865|566.074|
|AVX512|154.611|378.388|648.054|

AVX512指令icc的优化是不如gcc的，不知道是不是icc对最新指令集的支持有些问题，oneapi basic环境中的默认编译器是icx。

Intel(R) Xeon(R) Platinum 8360Y CPU @ 2.40GHz @Icelake @g++-9.4.0
g++ --std=c++11 -mavx512f -mavx512bw -O3

||InPlace|Order|Random|
|-|-|-|-|
|roll|399.627|580.871|816.332|
|AVX256|230.523|502.567|715.83|
|AVX512|210.472|457.633|720.467|

## 分析
实际代码测试了连续的256个浮点数由循环叠加改成应用avx512或avx256指令叠加后，不同模式下任务耗时情况。其中InPlace模式是对连续的256个浮点数反复N次做叠加操作，Order是对连续的N * 256浮点数做叠加操作，相对与InPlace增加了顺序访存的操作，Random是随机的从连续的N * 256个浮点数中取256个做叠加操作，重复N次，相对于Order，Random的随机性导致了随机访存。从结果可以看出，应用向量化指令后，任务时间显著低于循环。其中InPlace模式由于数据量小，数据基本都在L1缓存当中，所以任务时间比较好的反应了计算量，gcc的编译结果在不同平台上计算量缩短了一半左右。另外两种模式则由于访存问题时间相对于InPlace模式有所延长。所以可以得到的初步结论是，仅就累加计算来说，向量化节约了一半左右的指令，但是，除了累加操作以外，正常的计算中还会有一些访存指令，以及cache miss的问题，导致实际真实运算场景下，优化效果要小于50%。另一方面，测试代码保证了默认按照64字节对齐，实际场景由于内存对齐问题可能还会带来额外的overhead cost。

## 改进
由于XGBoost代码中对grad和hess的存储做了优化。实际存储时grad和hess是存储在一个GradStat结构体中的，对于循环来说，累加过程比较简单，重载GradStat的+运算就可以。但是对于向量化操作，典型的前缀和操作是对连续内存的的若干浮点数求前缀，但是实际存储是GradStat，对于grad和hess都是不连续的。举例说明256个GradStat对象存储在连续空间，共有512个浮点数。则需要对所有奇数位置的grad和偶数位置的hess分别求前缀和。这种"隔位"前缀和需要对现有算法做出改进。

## 改进代码

```c++
template<Mode mode = Mode::InPlace>
void vectorization(float* base_addr, float* result, int LEN, int N) {
    float *prefix = (float*)aligned_alloc(64, LEN * sizeof(float));
    float *base_addr_copy = base_addr;
    float *result_copy = result;
    std::random_device rd;
    std::default_random_engine e(rd());
    std::uniform_int_distribution<unsigned> rindex(0, N-1);
    for (int i = 0; i < N; i++) {
        for (unsigned int j = 0; j < LEN/(sizeof(__m512)/sizeof(float)) ;j += 1) {
            int offset = j * (sizeof(__m512)/sizeof(float));
            *((__m512*)(result) + j) = _mm512_add_ps((__m512)_mm512_bslli_epi128(*((__m512i*)(base_addr) + j), 8), *((__m512*)(base_addr) + j));
            *((__m512*)(result) + j) = _mm512_add_ps(*((__m512*)(result) + j), 
                *((__m512*)(prefix) + j) = _mm512_set_ps(
                    result[offset+11], result[offset+10], result[offset+11], result[offset+10],
                    0,0,0,0,
                    result[offset+3], result[offset+2],result[offset+3], result[offset+2],
                    0,0,0,0
                )
            );
        }
        
        *((__m512*)(prefix)) = _mm512_set_ps(
            result[7],result[6],result[7],result[6],
            result[7],result[6],result[7],result[6],
            0,0,0,0,
            0,0,0,0

        );
        for (int j = (sizeof(__m512)/sizeof(float)); j < LEN ;j += (sizeof(__m512)/sizeof(float))) {
            *((__m256*)(prefix + j)) = _mm256_add_ps(
                *(((__m256*)(prefix + j) - 1) ), _mm256_set_ps(
                    result[j-1],result[j-2],result[j-1],result[j-2],
                    result[j-1],result[j-2],result[j-1],result[j-2]
                )
            );
            *((__m256*)(prefix + j) + 1) = _mm256_add_ps(
                *(((__m256*)(prefix + j)) ), _mm256_set_ps(
                    result[j+7],result[j+6],result[j+7],result[j+6],
                    result[j+7],result[j+6],result[j+7],result[j+6]
                )
            );
        }
       
        for (unsigned int j = 0; j < LEN/(sizeof(__m512)/sizeof(float)); j += 1) {
            *((__m512*)(result) + j) = _mm512_add_ps(*((__m512*)(result) + j), *((__m512*)(prefix) + j));
        }
        
        if (mode == Mode::Order) {
            result += LEN;
            base_addr += LEN;
        } else if (mode == Mode::Random) {
            int offset = rindex(e);
            result = offset * LEN + result_copy;
            base_addr = offset * LEN + base_addr_copy;
        } else {
            continue;
        }
    }
}
```
```c++
void roll(float* base_addr, float* result, int LEN, int N) {
    float *base_addr_copy = base_addr;
    float *result_copy = result;
    std::random_device rd;
    std::default_random_engine e(rd());
    std::uniform_int_distribution<unsigned> rindex(0, N-1);
    for (int i = 0; i < N; i++) {
        result[0] = base_addr[0];
        result[1] = base_addr[1];
        for (int j = 2; j < LEN; j++) {
            result[j] = result[j-2] + base_addr[j];
        }
        if (mode == Mode::Order) {
            result += LEN;
            base_addr += LEN;
        } else if (mode == Mode::Random) {
            int offset = rindex(e);
            result = offset * LEN + result_copy;
            base_addr = offset * LEN + base_addr_copy;
        } else {
            continue;
        }
    }
}
```

## 改进结果

11th Gen Intel(R) Core(TM) i7-1165G7 @ 2.80GHz @Tigerlake @g++-11.2.0
g++ --std=c++11 -mavx512f -mavx512bw -O3

||InPlace|Order|Random|
|-|-|-|-|
|roll|224.431|588.578|871.663|
|AVX512|168.233|611.044|876.211|

11th Gen Intel(R) Core(TM) i7-1165G7 @ 2.80GHz @Tigerlake @icc-2021.7.0
icc -diag-disable=10441 -std=c++11 -mavx512f -mavx512bw -O3

||InPlace|Order|Random|
|-|-|-|-|
|roll|295.24|664.485|905.78|
|AVX512|456.798|828.897|1055.27|

Intel(R) Xeon(R) Platinum 8360Y CPU @ 2.40GHz @Icelake @g++-9.4.0
g++ --std=c++11 -mavx512f -mavx512bw -O3

||InPlace|Order|Random|
|-|-|-|-|
|roll|430.179|829.157|1087.9|
|AVX512|328.099|865.534|1088.2|


