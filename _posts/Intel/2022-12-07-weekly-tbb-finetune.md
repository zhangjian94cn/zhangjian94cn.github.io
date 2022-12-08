---
title: "Optimize Group Tree Speed"
layout: post
author: "Zhang Jian"
header-style: text
mathjax: true
tags:
  - work
  - weekly
---

## speed optimization

This week, I have tried following methods to accelerate the speed of prediction:

### use tbb allocator

```cpp
// in group tree
std::vector<NodeGroup, tbb::tbb_allocator<NodeGroup>> _groups;
std::vector<float, tbb::tbb_allocator<float>> _leaf;

// in gbt
std::vector<RegTree, tbb::tbb_allocator<RegTree>> _trees;
```

### add cache affinity

```cpp
void parallel_for( const Range& range, const Body& body, affinity_partitioner& partitioner ) {
    start_for<Range,Body,affinity_partitioner>::run(range,body,partitioner);
}
```
It works like folllowing:

![](/img/20221207202342.png)  


### blocked method

**before**

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

**after**

```cpp
// exp7 2D block range parallel
tbb::parallel_for(
    tbb::blocked_range2d<size_t>(0, nT, 0, nD), 
    [&](const tbb::blocked_range2d<size_t>& r){
    
    for(size_t i = r.cols().begin(); i != r.cols().end(); i++) {
        for(size_t j = r.rows().begin(); j != r.rows().end(); j++) {
            const int offsetD = i * iblockD, offsetT = j * iblockT;
            for (int kD = 0 ;kD < iblockD; ++ kD) {
                for (int kT = 0 ;kT < iblockT; ++ kT) {
                    res[offsetD + kD] += \
                        gbt._trees[offsetT + kT].predictTree(data + (offsetD + kD) * featDim);
                }
            }
        }
    }
});
```

### change the nesting of loop

also achieve some performance improvement

```cpp
// exp 8 2D blocked parallel (tree outer, data inner) and use memory affinity
static tbb::affinity_partitioner ap;
tbb::parallel_for(
    tbb::blocked_range2d<size_t>(0, nT, 0, nD), 
    [&](const tbb::blocked_range2d<size_t>& r){
    
    for(size_t i = r.cols().begin(); i != r.cols().end(); i++)
    for(size_t j = r.rows().begin(); j != r.rows().end(); j++)
    {   
        const int offsetD = i * iblockD, offsetT = j * iblockT;
        for (int kT = 0 ;kT < iblockT; ++ kT) {
            for (int kD = 0 ;kD < iblockD; ++ kD) {
                res[offsetD + kD] += \
                    gbt._trees[offsetT + kT].predictTree(data + (offsetD + kD) * featDim);
            }
        }
    }
}, ap);
```

### final result

last week 13.x s, currently 11.x s

![](/img/20221207200557.png)  

achieve 19.x / 11.x = 1.7 speedup

## Compilation Flag

I checked onedal's makefile and found the flag that specify the usage of avx512

```makefile
# in makefile
include dev/make/cmplr.$(COMPILER).mk
```

```makefile
# dev/make/cmplr.icc.mk
p4_OPT.icc   = $(-Q)$(if $(OS_is_mac),xSSE4.2,xSSE2)
mc_OPT.icc   = $(-Q)$(if $(OS_is_mac),xSSE4.2,xSSE3)
mc3_OPT.icc  = $(-Q)xSSE4.2
avx_OPT.icc  = $(-Q)xAVX
avx2_OPT.icc = $(-Q)xCORE-AVX2
skx_OPT.icc  = $(-Q)xCORE-AVX512 $(-Qopt)zmm-usage=high
#TODO add march opts in GCC style
```

icc developer guide

![](/img/20221207205104.png)  


### exp1 

比较-xhost指令与指定avx512的编译指令，测试代码：对内层循环进行向量化

```cpp
for(long long i = 0; i < cycleNum; ++ i) {
    #pragma ivdep
    #pragma vector always
    for (int j = 0; j < 1024; ++ j) {
        a[j] += b[j];
    }
}
```

使用xhost，运行100,000,000次，时间消耗：6336.42ms

```cmake
SET(CMAKE_C_FLAGS  "-xhost -O3")
SET(CMAKE_CXX_FLAGS  "-xhost -O3")
```

使用avx512，运行100,000,000次，时间消耗：7402.98ms

```cmake
SET(CMAKE_C_FLAGS  "-O3 -xCORE-AVX512 -qopt-zmm-usage=high")
SET(CMAKE_CXX_FLAGS  "-O3 -xCORE-AVX512 -qopt-zmm-usage=high")
```

### exp2 

```cpp
for(long long i = 0; i < cycleNum; ++ i) {
    for (int j = 0; j < 1024; ++ j) {
        a[j] += b[j];
    }
}
```

使用xhost，运行100,000,000次，时间消耗：2449.2ms

```cmake
SET(CMAKE_C_FLAGS  "-xhost -O3")
SET(CMAKE_CXX_FLAGS  "-xhost -O3")
```

使用avx512，运行100,000,000次，时间消耗：1397.19ms

```cmake
SET(CMAKE_C_FLAGS  "-O3 -xCORE-AVX512 -qopt-zmm-usage=high")
SET(CMAKE_CXX_FLAGS  "-O3 -xCORE-AVX512 -qopt-zmm-usage=high")
```

### analysis

-xhost

```
    for(long long i = 0; i < cycleNum; ++ i) {
        core_auto(a, b, index);
  402780:	48 8b 9c 24 b0 13 00 	mov    0x13b0(%rsp),%rbx
  402787:	00 
    for (int j = 0; j < 1024; ++ j) {
  402788:	33 d2                	xor    %edx,%edx
        core_auto(a, b, index);
  40278a:	48 8b 8c 24 c8 13 00 	mov    0x13c8(%rsp),%rcx
  402791:	00 
  402792:	33 c0                	xor    %eax,%eax
        a[j] += b[j];
  402794:	c5 fc 57 c0          	vxorps %ymm0,%ymm0,%ymm0
  402798:	c5 7c 28 c8          	vmovaps %ymm0,%ymm9
        core_auto(a, b, index);
  40279c:	89 c6                	mov    %eax,%esi
        a[j] += b[j];
  40279e:	c4 41 7c 28 c1       	vmovaps %ymm9,%ymm8
  4027a3:	c4 c1 7c 28 f8       	vmovaps %ymm8,%ymm7
  4027a8:	c5 fc 28 f7          	vmovaps %ymm7,%ymm6
  4027ac:	c5 fc 28 ee          	vmovaps %ymm6,%ymm5
  4027b0:	c5 fc 28 e5          	vmovaps %ymm5,%ymm4
  4027b4:	c5 fc 28 dc          	vmovaps %ymm4,%ymm3
  4027b8:	c5 7a 10 14 93       	vmovss (%rbx,%rdx,4),%xmm10
  4027bd:	c5 fc 28 d3          	vmovaps %ymm3,%ymm2
  4027c1:	c4 e2 7d 18 0c 91    	vbroadcastss (%rcx,%rdx,4),%ymm1
        core_auto(a, b, index);
  4027c7:	83 c6 40             	add    $0x40,%esi
        a[j] += b[j];
  4027ca:	c5 34 58 c9          	vaddps %ymm1,%ymm9,%ymm9
  4027ce:	c5 3c 58 c1          	vaddps %ymm1,%ymm8,%ymm8
  4027d2:	c5 c4 58 f9          	vaddps %ymm1,%ymm7,%ymm7
  4027d6:	c5 cc 58 f1          	vaddps %ymm1,%ymm6,%ymm6
  4027da:	c5 d4 58 e9          	vaddps %ymm1,%ymm5,%ymm5
  4027de:	c5 dc 58 e1          	vaddps %ymm1,%ymm4,%ymm4
  4027e2:	c5 e4 58 d9          	vaddps %ymm1,%ymm3,%ymm3
  4027e6:	c5 ec 58 d1          	vaddps %ymm1,%ymm2,%ymm2
        core_auto(a, b, index);
  4027ea:	81 fe 00 e1 f5 05    	cmp    $0x5f5e100,%esi
  4027f0:	72 d5                	jb     4027c7 <main+0x437>
        a[j] += b[j];
  4027f2:	c4 c1 34 58 c8       	vaddps %ymm8,%ymm9,%ymm1
  4027f7:	c5 c4 58 f6          	vaddps %ymm6,%ymm7,%ymm6
  4027fb:	c5 d4 58 e4          	vaddps %ymm4,%ymm5,%ymm4
  4027ff:	c5 e4 58 d2          	vaddps %ymm2,%ymm3,%ymm2
  402803:	c5 f4 58 de          	vaddps %ymm6,%ymm1,%ymm3
  402807:	c5 dc 58 ea          	vaddps %ymm2,%ymm4,%ymm5
  40280b:	c5 e4 58 fd          	vaddps %ymm5,%ymm3,%ymm7
  40280f:	c4 c3 7d 19 f8 01    	vextractf128 $0x1,%ymm7,%xmm8
  402815:	c4 41 40 58 c8       	vaddps %xmm8,%xmm7,%xmm9
  40281a:	c4 41 30 12 d9       	vmovhlps %xmm9,%xmm9,%xmm11
  40281f:	c4 41 30 58 e3       	vaddps %xmm11,%xmm9,%xmm12
  402824:	c4 41 18 c6 ec f5    	vshufps $0xf5,%xmm12,%xmm12,%xmm13
  40282a:	c4 41 1a 58 f5       	vaddss %xmm13,%xmm12,%xmm14
  40282f:	c4 41 2a 58 d6       	vaddss %xmm14,%xmm10,%xmm10
  402834:	c5 7a 11 14 93       	vmovss %xmm10,(%rbx,%rdx,4)
    for (int j = 0; j < 1024; ++ j) {
  402839:	48 ff c2             	inc    %rdx
  40283c:	48 81 fa 00 04 00 00 	cmp    $0x400,%rdx
  402843:	0f 82 4f ff ff ff    	jb     402798 <main+0x408>
```

avx512

```
    for(long long i = 0; i < cycleNum; ++ i) {
        core_auto(a, b, index);
  402780:	48 8b 9c 24 b0 13 00 	mov    0x13b0(%rsp),%rbx
  402787:	00 
    for (int j = 0; j < 1024; ++ j) {
  402788:	33 d2                	xor    %edx,%edx
        core_auto(a, b, index);
  40278a:	48 8b 8c 24 c8 13 00 	mov    0x13c8(%rsp),%rcx
  402791:	00 
  402792:	33 c0                	xor    %eax,%eax
        a[j] += b[j];
  402794:	62 f1 7d 48 ef c0    	vpxord %zmm0,%zmm0,%zmm0
  40279a:	62 71 7c 48 28 c8    	vmovaps %zmm0,%zmm9
        core_auto(a, b, index);
  4027a0:	89 c6                	mov    %eax,%esi
        a[j] += b[j];
  4027a2:	62 51 7c 48 28 c1    	vmovaps %zmm9,%zmm8
  4027a8:	62 d1 7c 48 28 f8    	vmovaps %zmm8,%zmm7
  4027ae:	62 f1 7c 48 28 f7    	vmovaps %zmm7,%zmm6
  4027b4:	62 f1 7c 48 28 ee    	vmovaps %zmm6,%zmm5
  4027ba:	62 f1 7c 48 28 e5    	vmovaps %zmm5,%zmm4
  4027c0:	62 f1 7c 48 28 dc    	vmovaps %zmm4,%zmm3
  4027c6:	c5 7a 10 14 93       	vmovss (%rbx,%rdx,4),%xmm10
  4027cb:	62 f1 7c 48 28 d3    	vmovaps %zmm3,%zmm2
  4027d1:	62 f2 7d 48 18 0c 91 	vbroadcastss (%rcx,%rdx,4),%zmm1
        core_auto(a, b, index);
  4027d8:	81 c6 80 00 00 00    	add    $0x80,%esi
        a[j] += b[j];
  4027de:	62 71 34 48 58 c9    	vaddps %zmm1,%zmm9,%zmm9
  4027e4:	62 71 3c 48 58 c1    	vaddps %zmm1,%zmm8,%zmm8
  4027ea:	62 f1 44 48 58 f9    	vaddps %zmm1,%zmm7,%zmm7
  4027f0:	62 f1 4c 48 58 f1    	vaddps %zmm1,%zmm6,%zmm6
  4027f6:	62 f1 54 48 58 e9    	vaddps %zmm1,%zmm5,%zmm5
  4027fc:	62 f1 5c 48 58 e1    	vaddps %zmm1,%zmm4,%zmm4
  402802:	62 f1 64 48 58 d9    	vaddps %zmm1,%zmm3,%zmm3
  402808:	62 f1 6c 48 58 d1    	vaddps %zmm1,%zmm2,%zmm2
        core_auto(a, b, index);
  40280e:	81 fe 00 e1 f5 05    	cmp    $0x5f5e100,%esi
  402814:	72 c2                	jb     4027d8 <main+0x448>
        a[j] += b[j];
  402816:	62 d1 34 48 58 c8    	vaddps %zmm8,%zmm9,%zmm1
  40281c:	62 f1 44 48 58 f6    	vaddps %zmm6,%zmm7,%zmm6
  402822:	62 f1 54 48 58 e4    	vaddps %zmm4,%zmm5,%zmm4
  402828:	62 f1 64 48 58 d2    	vaddps %zmm2,%zmm3,%zmm2
  40282e:	62 f1 74 48 58 de    	vaddps %zmm6,%zmm1,%zmm3
  402834:	62 f1 5c 48 58 ea    	vaddps %zmm2,%zmm4,%zmm5
  40283a:	62 71 64 48 58 c5    	vaddps %zmm5,%zmm3,%zmm8
  402840:	62 d3 3d 48 23 f8 ee 	vshuff32x4 $0xee,%zmm8,%zmm8,%zmm7
  402847:	62 51 44 48 58 d8    	vaddps %zmm8,%zmm7,%zmm11
  40284d:	62 53 25 48 23 cb 55 	vshuff32x4 $0x55,%zmm11,%zmm11,%zmm9
  402854:	62 51 34 48 58 e3    	vaddps %zmm11,%zmm9,%zmm12
  40285a:	62 51 7d 48 70 ec 4e 	vpshufd $0x4e,%zmm12,%zmm13
  402861:	62 51 1c 48 58 f5    	vaddps %zmm13,%zmm12,%zmm14
  402867:	62 51 7d 48 70 fe b1 	vpshufd $0xb1,%zmm14,%zmm15
  40286e:	62 c1 0c 48 58 c7    	vaddps %zmm15,%zmm14,%zmm16
  402874:	62 31 2e 08 58 d0    	vaddss %xmm16,%xmm10,%xmm10
  40287a:	c5 7a 11 14 93       	vmovss %xmm10,(%rbx,%rdx,4)
    for (int j = 0; j < 1024; ++ j) {
  40287f:	48 ff c2             	inc    %rdx
  402882:	48 81 fa 00 04 00 00 	cmp    $0x400,%rdx
  402889:	0f 82 0b ff ff ff    	jb     40279a <main+0x40a>
    }
```


### conclusion

如果存在大量的访存操作，会导致avx512性能的降低，通过尽可能增加寄存器的操作次数，可以发挥avx512


### next

1. 继续看下onedal
2. 整理目前的工作


