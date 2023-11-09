---
title: "Highly Accurate Image Segmentation"
layout: post
author: "Zhang Jian"
header-style: text
mathjax: true
tags:
  - dl
  - cv
  - segmentation
---

![](/img/peacock.jpeg)
自家服务器部（only CPU）署了了一个ISNet的服务，不定时开放，欢迎体验：[入口](http://124.222.119.248:7869/)

## 前言

最近回顾了一下之前使用过的高精度图像分割算法，从BASNet，到U2Net，再到2022年的DIS。高精度的图像分割技术在计算机视觉领域具有着极为重要的应用。通过准确地分离图像中的不同对象、区域和特征，我们可以实现：

1. **更安全的自动驾驶**：通过将道路、车道线、交通标志和行人精确分离，以帮助车辆导航
2. **更精确的医疗诊断**：通过将自动化的分割人体器官，可以实现高精度自动化的人体手术，同时也可以帮助患者实现精确的肿瘤检测和定位，以制定个性化的治疗计划。
3. **更佳的社交应用体验**，通过高精度的分割，我们可以实现各种创意效果，如背景虚化、景深效果和图像合成等等

此外，图像分割作为一项非常基础的视觉任务，它也是许多任务的关键组成部分。


## BASNet

这篇论文的贡献主要有两个：
- 提出了一个基于残差的Refine模块（Residual Refine Moduel）
- 使用了多层级的loss，分别是pixel，patch和map级别的BCE，SSIM，IOU loss

### predict-refine 网络架构

BASNet是一个类似U-Net的encoder-decoder的网络架构，其和传统分割网络的区别在于：增加了一个refine模块。refine模块的输入是：encoder的特征，其学习的目标是coarse predict网络与ground truth的残差

![](/img/basnet-arch.png)

### 多层级的混合loss

**BCE loss**，这是一个针对像素进行二分类的loss，**Structural SIMilarity (SSIM)** 是结构相似性的度量，一般用于衡量两张图的相似度，在这里用作loss是比较了：网络预测的mask和ground truth mask的差别，尤其会关注于边缘的效果。IOU是对整个图像的分割正确率的一种度量，将其最为loss，应当是希望整体上保证分割的效果


## U2Net

U2Net的主要贡献有两个：
- 提出了一个能融合多尺度信息的RSU（ReSidual U-blocks）结构
- 基于RSU结构的新的网络架构



### ReSidual U-blocks

下面就是RSU的结构简图，简单来说就是：残差的跨接维度是以一个unet为单位的。换句话说resnet结构中的weight layer被替换成了一个unet，这样做的优势在于u-block的输出可以认为是带有多尺度信息的，从而增强了模型的能力

<img src="/img/rsu-moduel.png" width="500" alt="Image Description">


### 网络架构

整体的网络架构是在原来的RSU模块的基础上再套一个UNet的结构，这也是为什么叫$U^2$的原因，对于每一层的特征输出，最终都会被concate到一起，得到一个融合之后的结果，也就是$S_{fuse}$。

需要注意的是，在loss计算时，不仅考虑了最终$S_{fuse}$，其每一个特征层的输出都会被加入到loss计算中去。



<img src="/img/u2net.png" width="600" alt="Image Description">



## Highly Accurate Dichotomous Image Segmentation（DIS）

这篇工作很大的贡献是在于：提供了一个高精度的分割数据集。尤其是对于物体细节这块，标注的非常精准，此类数据成本往往很高，能够公开出来是非常难得的。

![](/img/DIS5k-dataset.png)

此外，相对于U2Net，效果上也有了很大的提升，因此也是值得我们去一探究竟的

![](/img/u2net-isnet-cmp.png)

除了数据集的贡献之外，这篇工作提出了：
- 一种新的基于中间监督的基线IS-Net，它通过强制高维特征的直接同步来减少过拟合
- 人工矫正量 (HCE) 指标


### IS-Net网络架构

IS-Net的网络架构基本上是沿用了U2Net的结构（如下图所示），区别在于其对多尺度下的特征进行直接的监督。如何做到这一点呢？其将训练分成了两个阶段，第一阶段基于ground truth训练一个编码器，其包含了多尺度下对应的**特征ground truth**。而在第二阶段，我们就可以利用这些特征ground truth去训练原来的U2Net结构了。需要注意的是，在推理过程中，我们只需要下图左边这部分，右边是只参与训练的。

![](/img/is-net.png)


## 结语

通过本文，我们简单回顾了下高精度图像分割相关工作，其在计算机视觉领域具有着广泛的应用前景，为多个领域提供了强大的工具和解决方案。

这些算法的不断发展和改进使我们能够更准确地分离图像中的不同对象、区域和特征，从医学领域的肿瘤检测到自动驾驶中的道路分割，再到广告和社交媒体美化，都在发挥重要作用。它们也在计算机视觉、图像处理、农业、GIS、安全监控和艺术创意等领域取得了突破性进展。

未来，我们可以期待看到更多的创新和应用，使高精度图像分割技术变得更加广泛、强大，为解决复杂问题和提高图像质量提供更多可能性。随着技术的不断发展，图像分割将继续在各个领域中发挥着关键作用，推动着科学、医学、工程和创意领域的进步。

## 参考

- [BASNet](https://github.com/xuebinqin/BASNet)
- [U-2-Net](https://github.com/xuebinqin/U-2-Net)
- [DIS](https://github.com/xuebinqin/DIS)





