---
title: "ChatGPT Introduction"
layout: post
author: "Zhang Jian"
header-style: text
mathjax: true
tags:
  - dl
  - llm
---

## 提纲
1. summary
1. Transformer
2. Pre-trained Language Models (GPT/BERT)
3. Large Language Models 
   1. GPT-3
   2. ChatGPT
4. AI Framework Challenge
   1. [Megatron-LM](https://github.com/NVIDIA/Megatron-LM)
   2. [DeepSpeed](https://github.com/microsoft/DeepSpeed)
   3. [Colossal-AI](https://github.com/hpcaitech/ColossalAI)
      1. [Efficient and Easy Training of Large AI Models — Introducing Colossal-AI](https://medium.com/@hpcaitech/efficient-and-easy-training-of-large-ai-models-introducing-colossal-ai-ab571176d3ed)
      2. 

5. Model Structure Evolution 3/31

在nlp领域，核心问题是：解决可变长序列的训练和推理。因为输入并非固定长度，因此并不能直接使用mlp，因此引入了循环神经网络rnn，lstm，gru等技术，而这些网络存在前后依赖，难以很好的并行，也因此提出了transformer，而再往后nlp领域的模型架构基本都以transformer为基础，发展主要有几个方向：
1. 增大模型大小（模型尺寸，MoE）
2. 使用预训练模型，抽取一些更加本质的特征
3. 使用few shot提升在nlp子任务的效果
<!-- 4. 引入rl -->

2020年Transformer在CV领域一炮打响，谷歌提出的Vision Transformer (ViT)[3] (An Image is Worth 16x16 Words，模仿“An Image is Worth a thousand Words”)再次横空出世，只是简单的将图片切成16X16的patch，扔到原封不动的NLP的Transformer中，结果竟然就一骑绝尘，表现超过了一众沉淀了多年的CNN，最神奇的是，完全不考虑图像的特点， 什么CNN的平移不变性(Translational Invariance)和局部性(Locality) 统统都没有考虑，只要把图像打成patch后，丢到Transformer就成，和NLP的Sequence处理方法完全一样，这也再次诠释了"Attention is all you need!"。


2. Model Structure Evolution

介绍下模型公式，RNN，lstm

如果说rnn提供了使用mlp解决序列化可变长输出的范式，那么lstm解决了信息传播的长期依赖问题，可以看到blabla

然而，lstm和rnn都存在难以并行，效率低下等问题，而transformer恰好解决了这一切

3. Transformer

可以说，transformer展现出了惊人的能力，也因此逐渐成为nlp领域的基础架构。甚至transformer的作者都未曾预料到这一切，当初transformer只是为了解决nlp领域机器翻译的子问题而设计的

总的来说，transformer有以下几个优点


4. Transformer

接下来我会介绍一下transformer的具体细节，包括它的代码实现，最终你可以实现一个完整的gpt模型

5. gpt1

代码结构是怎么样的？怎么训练的

   1. 第一步是无监督预训练：blabla
   2. 第二步是对子任务进行有监督的微调（要结合下面一张的图）

6. gpt2

gpt2虽然将模型增大了很多，但其实效果并不是很好，反而在它之前的bert效果会好很多，但是他们是解决的不同的问题，bert用的是transformer的编码器，gpt用的是解码器，在任务的目标上gpt的任务目标更难（这也体现了openai的AGI愿景）

让我们具体看一下他是怎么把最后一步finetune给去掉的，blabla

实现效果

7. GPT 3
   1. zero-shot
   2. one-shot
   3. few-shot

通过在inference阶段加入这些example，对效果的提升是非常明显的

8. chatgpt
接下来让我们看下chatgpt在此基础上又做了些什么

blabla


9. Model Size and Training

在介绍完了chatgpt之后，我们基本了解了gpt基础的模型结构以及他的发展流程，而我们更关注的是在大模型和大数据下所带来的一些挑战，我们如何去更有效的训练模型

对于模型的训练来说，我列举了一些发展趋势:blabla

而具体到transformer的结构，可以发现其每个部分也是在越来越大，这就对我们的模型训练带来了很大的挑战


10. Train Large Models

openai也提供了一些解决方案：例如

11. Pipeline Parallelism

    1. 普通的流水线并行存在什么问题
    2. 使用了micro batch
    3. re-materialization技术

12. tensor parallel

    1. 继续对mlp的矩阵进行分解
    2. 

13. 



13. Tensor Parallelism

https://discuss.ray.io/t/model-parallelism-in-ray/4617

https://medium.com/@hpcaitech/efficient-and-easy-training-of-large-ai-models-introducing-colossal-ai-ab571176d3ed

https://openai.com/blog/techniques-for-training-large-neural-networks/

https://arxiv.org/abs/2211.13878

https://arxiv.org/pdf/2009.06732.pdf