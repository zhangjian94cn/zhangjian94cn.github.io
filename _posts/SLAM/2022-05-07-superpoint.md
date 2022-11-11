---
title: "SuperPoint"
subtitle: "slam"
layout: post
author: "Zhang Jian"
header-style: text
mathjax: true
tags:
  - note
  - slam
---



## FRAMEWORK

<img src="/img/SuperPoint/Untitled.png"/>

MAINLY THREE PARTS（pic above）：

1. **Interest Point Pre-Training**
    1. use synthetic dataset（easy to get corner pts, e.g. L/Y/T junctions...）
    2. train base detector（what is the detector‘s arch?）
        
        ![Untitled](/img/SuperPoint/Untitled%201.png)
        
    3. transfer to real img（next steps）
2. **Interest Point Self-Labeling**（sample random homography，generate pseudo-GT）
    1. use base detector to inference（init interest pts in real img）
    2. use homographic adaption（detail？）
3. **Joint Training**（interest pts and descriptor）
    1. loss
    2. network arch

## METHOD DETAIL

### NETWORK DESIGN

![Untitled](/img/SuperPoint/Untitled%202.png)

1. **encoder-decoder architecture**
    1. shared encoder（advantages？）
    2. two heads
2. **Shared Encoder**
    1. VGG-styled
    2. pixel cells<br>
        *three 2×2 non-overlapping max pooling operations in the encoder result in 8 × 8 pixel cells*
        
3. **Interest Point Decoder**
    1. NO upsampling layers（high computation & unwanted checkerboard artifacts）
    2. designed the interest point detection head（with an explicit decoder）<br>
        *This decoder has no parameters, and is known as “sub-pixel convolution” or “depth to space” in TensorFlow or “pixel shuffle” in PyTorch*
        
4. **Descriptor Decoder**
    1. similar to UCN（Universal Correspondence Network）
    2. perform bicubic interpolation of the descriptor and then L2-normalizes（fixed）

### LOSS FUNC

![Untitled](/img/SuperPoint/Untitled%203.png)

![Untitled](/img/SuperPoint/Untitled%204.png)

![Untitled](/img/SuperPoint/Untitled%205.png)

![Untitled](/img/SuperPoint/Untitled%206.png)

### HOMOGRAPHY

![Untitled](/img/SuperPoint/Untitled%207.png)

1. formulation
    
    ![Untitled](/img/SuperPoint/Untitled%208.png)
    
    - $I$: input image
    - $x$: resulting interest points
    - $f_\theta$: network
    - $\mathcal{H}$: homography
2. improved super-point detector
    
    ![Untitled](/img/SuperPoint/Untitled%209.png)
    
3. choosing homographies
    
    ![Untitled](/img/SuperPoint/Untitled%2010.png)
    
4. Iterative Homographic Adaptation
    
    ![Untitled](/img/SuperPoint/Untitled%2011.png)
    

## RESOURCE

[rpautrat/SuperPoint: Efficient neural feature detector and descriptor (github.com)](https://github.com/rpautrat/SuperPoint)

[magicleap/SuperPointPretrainedNetwork: PyTorch pre-trained model for real-time interest point detection, description, and sparse tracking (https://arxiv.org/abs/1712.07629) (github.com)](https://github.com/magicleap/SuperPointPretrainedNetwork)

[一种深度学习特征SuperPoint (qq.com)](https://mp.weixin.qq.com/s?__biz=MzU1MjY4MTA1MQ==&mid=2247556641&idx=3&sn=507c477626e338f93e629c7bc67a6407&chksm=fbfc3515cc8bbc03d4be35281067f2b93282e2787aa2083fea4d758d32cdde585ede01f078e5&mpshare=1&scene=1&srcid=0508mLjY0t6SdpEJSovTUkFC&sharer_sharetime=1652000972058&sharer_shareid=8fc6565eaeb0553c536a46e389bd4b3c&exportkey=AXNV3GF3KmHW0dBwyHdkE4U%3D&acctmode=0&pass_ticket=GoAvLPAMJyQPVPWlgh%2F6WcehnYBWuXQ3qhJNBqnP6qswP7WxGeu5spDAW73lYIK%2F&wx_header=0#rd)

[腾讯优图荣获CVPR2021 Image Matching Workshop双赛道冠亚军 (qq.com)](https://mp.weixin.qq.com/s?__biz=MzA3OTQ5OTk5MQ==&mid=2655175019&idx=1&sn=21eb3f5e21d3c57250ce51a7731a1839&chksm=8404e6d3b3736fc5ea5c8cd60c052f4ceb24a0203ecf6337811675a6caba0b297be6e5f5be66&mpshare=1&scene=1&srcid=0508A3foCMJzP2UlQzzn0hny&sharer_sharetime=1652001514709&sharer_shareid=8fc6565eaeb0553c536a46e389bd4b3c&exportkey=Aaj6tMgtk%2FqkmGtK5bp1y%2Fk%3D&acctmode=0&pass_ticket=GoAvLPAMJyQPVPWlgh%2F6WcehnYBWuXQ3qhJNBqnP6qswP7WxGeu5spDAW73lYIK%2F&wx_header=0#rd)