---
title: "基于AutoGen的多智能体架构设计"
subtitle: "多智能体对话系统"
layout: post
author: "Zhang Jian" 
header-style: text
mathjax: true
tags:
  - AI
  - 多智能体
  - AutoGen
  - 架构设计
---


<!-- > 📢 导读：本文详细介绍了一个基于多智能体的智能对话系统架构设计，从整体框架到具体实现，为您呈现完整的技术解决方案。 -->

## 🔍 一、整体架构设计

![多智能体架构设计](/img/mas-arch.png)

> 💡 我们采用分层模块化的设计理念，构建了一个灵活可扩展的多智能体系统。这种设计不仅确保了系统的高可用性，也为未来的功能扩展提供了良好的基础。

基于多智能体的架构设计采用分层模块化方案，主要包含以下核心组件：

### 1.1 顶层控制模块

1. **意图澄清Agent**：
   - 采用规则模板+相似度匹配处理模糊问题，阈值（例如<0.8）触发澄清
   - 结合用户画像和历史会话进行意图预测，准确率（例如>95%）才确认
   - 使用主动问答策略收集缺失信息，如套餐类型、使用场景等
   - 进行初步意图分类，支持查询、办理、咨询等类型
<img src="/img/intention-example.png" alt="意图澄清示例" style="width: 50%; max-width: 600px;">

1. **意图理解Agent**：
   - 使用NER（命名实体识别）技术识别业务实体（套餐名称、手机号码、时间等）
   - 基于预定义规则模板进行意图匹配和分类
   - 结合实体识别和规则匹配结果进行综合分析
   - 输出标准化的意图理解结果（实体、类型、置信度）
<img src="/img/ner.png" alt="命名实体识别示意图" style="width: 80%; max-width: 600px;">

2. **任务规划Agent**：
   - 基于DAG图构建任务执行流程，将复杂任务拆解为原子任务节点
   - 使用优先级队列管理任务调度，支持动态调整执行顺序
   - 采用状态机管理任务生命周期，包含待执行、执行中、完成、失败等状态
   - 通过发布-订阅模式实现任务间的解耦和异步通信
   - 内置任务重试和异常处理机制，确保任务执行的可靠性

### 1.2 业务执行模块
系统根据不同业务场景划分为多个并行的业务处理单元，每个单元包含两层智能体：

1. **意图识别Agent**：
   - 基于澄清结果精确识别用户意图
   - 基于上下文和历史交互智能推断用户真实意图
   - 处理badcase优化沉淀，持续提升意图识别准确率
   - 适配多个助手的意图识别，实现精准分发
   - 支持多维度意图识别，包括业务类型、查询范围、操作对象等

2. **业务逻辑Agent**：
   - 执行具体的业务操作：处理用户查询、执行业务办理、提供智能推荐
   - 负责与底层服务交互：调用业务接口、访问数据库、对接第三方系统
   - 处理业务规则校验：权限验证、规则约束、异常处理
   - 提供数据分析能力：数据统计、行为分析、性能监控

### 1.3 业务场景划分
系统支持多个并行的业务处理单元：
- 业务知识问答
- 问查算比
- 我的集团
- 其他助手服务


### 智能体框架

## 🛠️ 二、智能体框架选型

> 💡 框架选择关系到整个项目的成败，我们进行了深入的调研和分析。

### 2.1 调研方法与过程

> 🔍 如何选择最适合的框架？我们的调研过程是这样的：

**关于调研方法和过程** 我认为在评估智能体框架时，我们应该采取更加务实的调研方式。我们首先对市面上常见的智能体框架做了全面摸底，重点看了各个框架的使用情况、社区活跃度，以及实际落地案例。除此之外，我们也深入研究了每个框架的技术特点、性能表现和扩展能力，特别关注了它们的开发文档是否完善，技术栈是否能够很好地跟我们现有系统对接。

**关于业务特点的思考** 从我们移动业务的角度来看，我觉得有几个关键点特别重要：首先是要能扛住大流量，其次是要能适应我们多样化的业务场景，最后是要保证稳定性和安全性。这些业务特点决定了我们不能随便选择框架，而是需要一个既能保证性能，又足够灵活的解决方案。我们特别看重框架是否能够很好地处理复杂的对话流程，是否支持多轮对话，以及意图识别的准确度如何。

### 2.2 业务特点分析

> 🎯 从移动业务的特点出发，我们重点关注以下几个方面：

**为什么最终选择了AutoGen** 经过反复比较和讨论，我们觉得AutoGen是最适合我们的选择。说实话，这个决定并不是一蹴而就的。AutoGen吸引我们的地方主要有：它的API设计特别灵活，工具链也很完善，这对我们快速开发业务很有帮助；而且它支持多种编程语言，插件机制也很强大，这让我们能够根据实际需求进行定制开发；另外，有微软在背后支持，我们觉得框架的未来发展也更有保障。

**具体实施的一些想法** 为了落地AutoGen框架，我建议采取如下方案：

先以独立智能体的形式，将AutoGen模块以独立智能体的形式单独接入到现有的数智助手中。这种低成本验证能让我们在真实场景下迅速捕捉其表现和资源需求，及时发现问题。团队内部先进行一段试测，通过详细记录运行数据和用户反馈评估效果，再决定如何将该模块无缝融入整体业务框架中。


<table style="width: 100%;">
    <colgroup>
       <col style="width: 15%">
       <col style="width: 25%">
       <col style="width: 60%">
    </colgroup>
    <thead>
        <tr>
            <th>框架名称</th>
            <th>框架描述</th>
            <th>优缺点</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>Qwen-Agent</strong></td>
            <td>通义千问开源的智能体框架，提供了一套完整的智能体开发工具链 <a href="https://github.com/QwenLM/Qwen-Agent">GitHub</a></td>
            <td><strong>优点：</strong><br>• 基于Qwen大语言模型，中文理解能力强<br>• 提供丰富的工具调用能力，支持多种任务类型<br>• 支持多轮对话和任务规划<br>• 代码简洁易用，上手门槛低<br>• 提供完整的开发文档和示例<br><strong>缺点：</strong><br>• 框架相对较新，生态还在建设中<br>• 目前主要支持Python语言<br>• 对Qwen模型依赖较强<br>• 社区规模相对较小</td>
        </tr>
        <tr>
            <td><strong>AutoGPT</strong></td>
            <td>一个自动化的GPT任务执行框架，能够自主完成复杂任务链 <a href="https://github.com/Significant-Gravitas/Auto-GPT">GitHub</a></td>
            <td><strong>优点：</strong><br>• 自动化任务执行能力强<br>• 任务链扩展性好，可以处理复杂任务序列<br>• 社区活跃度高，更新迭代快<br>• 支持多种API集成<br><strong>缺点：</strong><br>• 对计算资源要求较高<br>• 实验性质较强，生产环境稳定性待验证<br>• 配置过程相对复杂</td>
        </tr>
        <tr>
            <td><strong>AgentGPT</strong></td>
            <td>一个基于Web界面的多智能体协作框架，支持多个智能体协同工作 <a href="https://github.com/reworkd/AgentGPT">GitHub</a></td>
            <td><strong>优点：</strong><br>• 多代理协同工作机制完善<br>• 界面友好，易于交互和操作<br>• 部署简单，上手快<br>• 支持自定义工作流<br><strong>缺点：</strong><br>• 技术文档相对欠缺<br>• 系统稳定性需要进一步验证<br>• 功能扩展性有限</td>
        </tr>
        <tr>
            <td><strong>LangChain Agents</strong></td>
            <td>一个模块化的大语言模型应用开发框架，提供了丰富的智能体工具和组件 <a href="https://github.com/langchain-ai/langchain">GitHub</a></td>
            <td><strong>优点：</strong><br>• 高度模块化设计，组件丰富<br>• 框架灵活性强，可定制性高<br>• 生态系统完善，工具链齐全<br>• 社区支持度高，案例丰富<br><strong>缺点：</strong><br>• 初始配置和设置较为复杂<br>• 学习曲线较陡峭<br>• 版本更新频繁，需要持续适配</td>
        </tr>
        <tr>
            <td><strong>BabyAGI</strong></td>
            <td>一个轻量级的自主智能体框架，适合入门学习和简单应用场景 <a href="https://github.com/yoheinakajima/babyagi">GitHub</a></td>
            <td><strong>优点：</strong><br>• 框架轻量，资源占用少<br>• 实现简单，代码易懂<br>• 入门门槛低，适合学习<br>• 部署维护成本低<br><strong>缺点：</strong><br>• 功能相对基础，复杂场景支持有限<br>• 企业级应用适用性不高<br>• 缺乏高级特性支持</td>
        </tr>
        <tr>
            <td><strong>AutoGen</strong></td>
            <td>微软开源的新一代智能体框架，支持多语言开发，提供完整的开发工具链 <a href="https://github.com/microsoft/autogen">GitHub</a></td>
            <td><strong>优点：</strong><br>• 多层次API设计，满足不同开发需求<br>• 强大的插件扩展系统<br>• 优秀的跨语言支持（特别是.NET与Python）<br>• 内置工具链丰富完善<br>• 微软官方支持，社区活跃<br>• 持续更新维护，版本稳定<br><strong>缺点：</strong><br>• 初始学习成本较高<br>• 对最新技术栈依赖度高<br>• 系统资源要求较高<br>• 部分高级功能文档不够详细</td>
        </tr>
    </tbody>
</table>

## 🎯 三、整体建设目标与规划

## 📅 四、一季度开发计划

### 一季度研发排期（基于多智能体的意图识别优化）
<table style="width: 100%; text-align: center;">
  <thead>
    <tr>
      <th style="text-align: center;"><strong>阶段</strong></th>
      <th style="text-align: center;"><strong>工作任务</strong></th>
      <th style="text-align: center;"><strong>描述</strong></th>
      <th style="text-align: center;"><strong>目标</strong></th>
      <th style="text-align: center;"><strong>进展</strong></th>
      <th style="text-align: center;"><strong>计划完成时间</strong></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td rowspan="2" style="background-color: #f8f9fa;"><strong>1阶段</strong><br>(1月20 ~ 2月10)</td>
      <td><strong>设计</strong></td>
      <td style="text-align: left;">完善技术架构设计，明确各模块功能及接口定义</td>
      <td style="text-align: left;">完成数智助手核心智能体的架构设计，输出详细的技术文档与设计图</td>
      <td><span style="color: #1890ff;">进行中</span></td>
      <td>2025年2月6日</td>
    </tr>
    <tr>
      <td><strong>搭建</strong></td>
      <td style="text-align: left;">搭建基础框架，涵盖代码初始化、服务配置、日志管理等内容，为后续开发提供标准化支撑</td>
      <td style="text-align: left;">搭建稳定可靠的基础框架，确保系统的可扩展性和易维护性</td>
      <td><span style="color: #d9d9d9;">待开发</span></td>
      <td>2025年2月10日</td>
    </tr>
    <tr>
      <td rowspan="3" style="background-color: #f8f9fa;"><strong>2阶段</strong><br>(2月11 ~ 3月5)</td>
      <td><strong>智能体通信机制</strong></td>
      <td style="text-align: left;">实现智能体之间的通信，确保多模块数据交互的准确性和可靠性</td>
      <td style="text-align: left;">实现智能体的通信机制，确保数据传递的高效性和一致性</td>
      <td><span style="color: #d9d9d9;">待开发</span></td>
      <td>2025年2月14日</td>
    </tr>
    <tr>
      <td><strong>意图澄清与识别</strong></td>
      <td style="text-align: left;">实现自然语言处理模块，支持用户意图的澄清与精确识别</td>
      <td style="text-align: left;">开发意图澄清与识别模块，支持多种用户场景需求</td>
      <td><span style="color: #d9d9d9;">待开发</span></td>
      <td>2025年2月21日</td>
    </tr>
    <tr>
      <td><strong>模块串联与协作</strong></td>
      <td style="text-align: left;">将业务智能体串联起来，形成逻辑闭环，确保核心功能模块能够协同工作</td>
      <td style="text-align: left;">完成模块间的串联与协作，实现智能体的核心功能闭环</td>
      <td><span style="color: #d9d9d9;">待开发</span></td>
      <td>2025年3月5日</td>
    </tr>
    <tr>
      <td rowspan="3" style="background-color: #f8f9fa;"><strong>3阶段</strong><br>(3月6 ~ 3月21日)</td>
      <td><strong>性能优化</strong></td>
      <td style="text-align: left;">通过负载测试与压力测试优化系统响应速度、并发处理能力及资源利用率</td>
      <td style="text-align: left;">优化智能体性能，达到预期的响应速度与并发处理指标</td>
      <td><span style="color: #d9d9d9;">待开发</span></td>
      <td>2025年3月10日</td>
    </tr>
    <tr>
      <td><strong>单元测试与集成测试</strong></td>
      <td style="text-align: left;">对各模块功能进行深入测试，并模拟实际场景进行集成测试，验证模块协作的稳定性</td>
      <td style="text-align: left;">完成单元测试与集成测试，确保系统的稳定性和功能完整性</td>
      <td><span style="color: #d9d9d9;">待开发</span></td>
      <td>2025年3月14日</td>
    </tr>
    <tr>
      <td><strong>上线准备</strong></td>
      <td style="text-align: left;">完成所有测试后，输出上线评估报告，为正式交付提供保障</td>
      <td style="text-align: left;">输出测试报告及上线评估文档，为交付做好准备</td>
      <td><span style="color: #d9d9d9;">待开发</span></td>
      <td>2025年3月21日</td>
    </tr>
  </tbody>
</table>

## 🧠 五、Deepseek R1 融合

为了进一步提升系统的语义理解和意图解析能力，我们计划引入最新的 Deepseek R1 模型，并将其与现有的多智能体架构深度融合。Deepseek R1 模型在深层语义分析、实体识别和复杂意图解析方面具有显著优势，为整体系统提供额外的智能支撑。

### 5.1 集成方案一：基于深度思考过程的认知迭代

在原有意图澄清与理解模块的基础上，我们进一步提取 Deepseek R1 模型内部的思考过程（chain-of-thought），并在此过程中调用知识库进行信息补充与反馈，使模型能通过多轮迭代不断优化解析结果。

整体流程如下：
1. **初步解析与思考**：调用 Deepseek R1 模型进行初步语义解析，并提取模型内部生成的思考过程（包含临时推理步骤、归纳信息等）。
2. **知识库查询**：利用初步生成的思考过程作为查询条件，获取相关的背景知识和数据补充。
3. **融合与迭代优化**：将知识库返回的信息与原始思考过程进行融合，作为下一轮输入，经过多轮迭代逐步收敛，直至输出稳定结果。

**示例代码：**

```python:title:deepseek_iterative.py
def deepseek_iterative_analysis(user_input, max_iterations=3):
    # 第一步：调用 Deepseek R1 生成初步解析结果和内部思考过程
    initial_result = deepseek_r1_api(user_input, mode="chain-of-thought")
    # initial_result 示例格式：
    # {"result": "初步解析结果", "chain_of_thought": "初步思考过程"}
    
    combined_input = initial_result["chain_of_thought"]
    for i in range(max_iterations):
        # 查询知识库，根据当前思考过程查找背景数据
        kb_info = query_knowledge_base(combined_input)
        # 将知识库信息与当前思考内容组合，形成用于优化的新输入
        input_for_refinement = f"{combined_input}\n额外信息：{kb_info}"
        # 迭代优化：调用 Deepseek R1 进行进一步解析
        refined_result = deepseek_r1_api(input_for_refinement, mode="iterative-refinement")
        # 更新思考过程
        combined_input = refined_result.get("chain_of_thought", combined_input)
        # 根据一定收敛指标判断是否提前退出迭代
        if has_converged(combined_input):
            break
    final_result = {
        "final_intent": refined_result.get("result", initial_result["result"]),
        "final_chain_of_thought": combined_input
    }
    return final_result

# 辅助函数（伪代码实现）
def query_knowledge_base(query_text):
    """
    根据提供的查询文本在内部知识库中检索相关信息，
    这里返回的是模拟结果。
    """
    return "相关的背景知识或数据"

def has_converged(chain_text):
    """
    判定收敛条件：例如检测思考过程变化是否小于预设阈值
    """
    return len(chain_text) < 100 or "converged" in chain_text
```

上述代码展示了如何通过多轮迭代，将 Deepseek R1 的内部思考过程与外部知识库数据相结合，以实现逐步优化的语义解析。

### 5.2 集成方案二：新增独立 Deepseek R1 Agent

为了更灵活地利用 Deepseek R1 的能力，可以将其封装为一个独立的智能体，作为整个多智能体协作系统中的一员。其他 Agent 在遇到复杂语义问题时，可主动调用此 Deepseek Agent 获取更精细的解析结果。

**示例代码：**

```python:title:deepseek_agent.py
import requests

class DeepseekAgent:
    def __init__(self, api_token):
        self.api_token = api_token
        self.endpoint = "https://api.deepseekr1.com/analyze"

    def analyze(self, user_input):
        payload = {"input": user_input}
        headers = {"Authorization": f"Bearer {self.api_token}"}
        response = requests.post(self.endpoint, json=payload, headers=headers)
        if response.status_code == 200:
            return response.json()
        else:
            return {}

# 示例：在多智能体系统中调用 DeepseekAgent
def process_with_deepseek_agent(user_input):
    deepseek_agent = DeepseekAgent(api_token="YOUR_API_TOKEN")
    result = deepseek_agent.analyze(user_input)
    return result
```

### 5.3 融合优势与效果展望

- **准确性提升**：深层语义解析有助于显著提高意图和实体识别的准确率，降低错误理解的概率。
- **决策支持**：融合后的解析结果可为任务规划和后续处理提供更可靠的语义信息，优化决策流程。
- **模块灵活性**：无论是作为现有 Agent 的增强，还是独立智能体存在，Deepseek R1 模型均可以根据业务需求灵活调度和升级。

未来，我们将持续监控 Deepseek R1 模型在实际场景下的表现，并根据用户反馈不断优化融合策略，确保系统在智能化水平上保持领先。