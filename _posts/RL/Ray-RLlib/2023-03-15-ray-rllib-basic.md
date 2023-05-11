---
title: "RLlib: Industry-Grade Reinforcement Learning"
layout: post
author: "Zhang Jian"
header-style: text
mathjax: true
tags:
  - ray
  - rl
---

本文主要参考ray rllib的[官方文档](https://docs.ray.io/en/latest/rllib/index.html)

## 简介

<!-- **RLlib** is an open-source library for reinforcement learning (RL), offering support for production-level, highly distributed RL workloads while maintaining unified and simple APIs for a large variety of industry applications. Whether you would like to train your agents in a **multi-agent** setup, purely from **offline** (historic) datasets, or using **externally connected simulators**, RLlib offers a simple solution for each of your decision making needs. -->


RLlib是一个为强化学习（RL）提供支持的开源库，可以支持生产级的高度分布式的强化学习，同时还使用了统一而简单的API。无论您想要在**多智能体**环境下训练智能体，或者仅通过**离线**（历史）数据集训练，还是使用**外部模拟器**训练，RLlib都提供了简单的解决方案。

整体流程如下：

```python
from ray.rllib.algorithms.ppo import PPOConfig

config = (  # 1. Configure the algorithm,
    PPOConfig()
    .environment("Taxi-v3")
    .rollouts(num_rollout_workers=2)
    .framework("tf2")
    .training(model={"fcnet_hiddens": [64, 64]})
    .evaluation(evaluation_num_workers=1)
)

algo = config.build()  # 2. build the algorithm,

for _ in range(5):
    print(algo.train())  # 3. train it,

algo.evaluate()  # 4. and evaluate it.
```

<!-- 要点：
1. env
2. rollouts: the number of parallel workers to collect samples
3. framewor: tf, tf2, torch
4. model
5. evaluation -->


## 教程

### [Getting Started](https://docs.ray.io/en/master/rllib/rllib-training.html)

RLlib主要有CLI和Python，此外还提供了一些[优化过的配置yaml](https://github.com/ray-project/ray/blob/master/rllib/tuned_examples)。如果你想要自定义[environments, preprocessors, or models](https://docs.ray.io/en/latest/rllib/rllib-models.html)可以使用Python API.

#### Using the Python API

接下来，我们简单介绍下python api的用法，参数优化以及checkpoint的保存与加载

```python
# 1. 整体用法
from ray.rllib.algorithms.ppo import PPOConfig
from ray.tune.logger import pretty_print


algo = (
    PPOConfig()
    .rollouts(num_rollout_workers=1)
    .resources(num_gpus=0)
    .environment(env="CartPole-v1")
    .build()
)

for i in range(10):
    result = algo.train()
    print(pretty_print(result))

    if i % 5 == 0:
        checkpoint_dir = algo.save()
        print(f"Checkpoint saved in directory {checkpoint_dir}")

# 2. 参数优化

import ray
from ray import air, tune

ray.init()

config = PPOConfig().training(lr=tune.grid_search([0.01, 0.001, 0.0001]))

tuner = tune.Tuner(
    "PPO",
    run_config=air.RunConfig(
        stop={"episode_reward_mean": 150},
        checkpoint_config=air.CheckpointConfig(checkpoint_at_end=True),
    ),
    param_space=config,
)

tuner.fit()

# checkpoint保存
# Get the best result based on a particular metric.
best_result = results.get_best_result(metric="episode_reward_mean", mode="max")

# Get the best checkpoint corresponding to the best result.
best_checkpoint = best_result.checkpoint

# checkpoint读取
from ray.rllib.algorithms.algorithm import Algorithm
algo = Algorithm.from_checkpoint(checkpoint_path)
```

基于训练好的agent来进行action，主要使用的接口是：`Algorithm.compute_single_action()`，核心代码如下：

```python
while not terminated and not truncated:
    action = algo.compute_single_action(obs)
    if gymnasium:
        obs, reward, terminated, truncated, info = env.step(action)
    else:
        obs, reward, terminated, info = env.step(action)
    episode_reward += reward
```

更多的高级用法可以参考[RLlib Algorithm API documentation](https://docs.ray.io/en/latest/rllib/package_ref/algorithm.html#rllib-algorithm-api)


如果你想获得**policy状态**，可以使用如下方法：

```python
from ray.rllib.algorithms.dqn import DQNConfig

algo = DQNConfig().environment(env="CartPole-v1").build()

# Get weights of the default local policy
algo.get_policy().get_weights()

# Same as above
algo.workers.local_worker().policy_map["default_policy"].get_weights()

# Get list of weights of each worker, including remote replicas
algo.workers.foreach_worker(lambda worker: worker.get_policy().get_weights())

# Same as above, but with index.
algo.workers.foreach_worker_with_id(
    lambda _id, worker: worker.get_policy().get_weights()
)
```

同样你也可以获得模型状态（Model State），参见[Accessing Model State](https://docs.ray.io/en/latest/rllib/rllib-training.html#accessing-model-state)


#### [Configuring RLlib Algorithms](https://docs.ray.io/en/latest/rllib/rllib-training.html#configuring-rllib-algorithms)

关于算法的使用，主要通过模块化的配置来实现，主要接口是：`config = AlgorithmConfig()`

```python
# trainer
from ray.rllib.algorithms.algorithm_config import AlgorithmConfig
from ray.rllib.algorithms.callbacks import MemoryTrackingCallbacks
# Construct a generic config object, specifying values within different
# sub-categories, e.g. "training".
config = AlgorithmConfig().training(gamma=0.9, lr=0.01)  
    .environment(env="CartPole-v1")
    .resources(num_gpus=0)
    .rollouts(num_rollout_workers=4)
    .callbacks(MemoryTrackingCallbacks)
# A config object can be used to construct the respective Trainer.
rllib_algo = config.build()  
```

```python
# tunner
from ray.rllib.algorithms.algorithm_config import AlgorithmConfig
from ray import tune
# In combination with a tune.grid_search:
config = AlgorithmConfig()
config.training(lr=tune.grid_search([0.01, 0.001])) 
# Use `to_dict()` method to get the legacy plain python config dict
# for usage with `tune.Tuner().fit()`.
tune.Tuner(  
    "[registered trainer class]", param_space=config.to_dict()
    ).fit()
```

配置选项较多，不一一列举，参看[Specifying Training Options](https://docs.ray.io/en/latest/rllib/rllib-training.html#specifying-training-options)


### [Key Concepts](https://docs.ray.io/en/master/rllib/key-concepts.html)

In RLlib, you use **Algorithms** to learn how to solve problem **environments**. The algorithms use **policies** to select **actions**. Given a policy, **rollouts** throughout an **environment** produce **sample batches** (or **trajectories**) of experiences. You can also customize the **training_steps** of your RL experiments.

#### [Environments](https://docs.ray.io/en/latest/rllib/key-concepts.html#environments)

An RLlib environment consists of:

- all possible actions (**action space**)
- a complete description of the environment, nothing hidden (**state space**)
- an observation by the agent of certain parts of the state (**observation space**)
- **reward**, which is the only feedback the agent receives per action.

![](/img/env_key_concept2.png)

什么是：episode，rollout. 
>The simulation iterations of `action -> reward -> next state -> train -> repeat`, until the end state, is called an **episode**, or in RLlib, a **rollout**.

#### [Algorithms](https://docs.ray.io/en/latest/rllib/key-concepts.html#algorithms)

Algorithm的构建（3种方式）

```python
# Configure.
from ray.rllib.algorithms.ppo import PPOConfig
config = PPOConfig().environment(env="CartPole-v1").training(train_batch_size=4000)

# Build.
algo = config.build()

# Train.
while True:
    print(algo.train())
```

RLlib Algorithm classes coordinate the distributed workflow of running rollouts and optimizing policies. Algorithm classes leverage parallel iterators to implement the desired computation pattern. The following figure shows synchronous sampling, the simplest of these patterns:
![](/img/env_key_synchronous_sampling.png)


rllib使用[actor](https://docs.ray.io/en/latest/ray-core/actors.html)把training的过程从一个core扩展到上千个core，通过配置训练过程中的[parallelism](https://docs.ray.io/en/latest/rllib/rllib-training.html#specifying-resources)，也就是`num_workers`参数，更多细节参考[scaling guide](https://docs.ray.io/en/latest/rllib/rllib-training.html#rllib-scaling-guide) 

>  For example, setting num_workers=0 will only create the local worker, in which case both sample collection and training will be done by the local worker. On the other hand, setting num_workers=5 will create the local worker (responsible for training updates) and 5 remote workers (responsible for sample collection).


#### [Policies](https://docs.ray.io/en/latest/rllib/key-concepts.html#policies)

[policy](https://docs.ray.io/en/latest/rllib/rllib-concepts.html#policies)是RLlib中的核心概念，简单来说，policies是：定义agent在环境中行为方式的python类。Rollout workers基于policy决定agent的行为。在 [Farama-Foundation Gymnasium](https://docs.ray.io/en/latest/rllib/rllib-env.html#gymnasium) 中，有一个agent和一个policy。在 [vector envs](https://docs.ray.io/en/latest/rllib/rllib-env.html#vectorized) 中，policy inference is for multiple agents at once。在 [multi-agent](https://docs.ray.io/en/latest/rllib/rllib-env.html#multi-agent-and-hierarchical) 中，there may be multiple policies, each controlling one or more agents。

![](/img/multi-flat.png)

Policies 可以基于任何框架实现，RLlib 提供了 [build_tf_policy](https://docs.ray.io/en/latest/rllib/rllib-concepts.html#building-policies-in-tensorflow) and [build_torch_policy](https://docs.ray.io/en/latest/rllib/rllib-concepts.html#building-policies-in-pytorch) helper functions


```python
def policy_gradient_loss(policy, model, dist_class, train_batch):
    logits, _ = model.from_batch(train_batch)
    action_dist = dist_class(logits, model)
    return -tf.reduce_mean(
        action_dist.logp(train_batch["actions"]) * train_batch["rewards"])

# <class 'ray.rllib.policy.tf_policy_template.MyTFPolicy'>
MyTFPolicy = build_tf_policy(
    name="MyTFPolicy",
    loss_fn=policy_gradient_loss)
```

#### Policy Evaluation

给定一个environment and policy，policy evaluation过程会生成batches of experiences，也就是 “environment interaction loop”。高效的 policy evaluation，往往实现起来比较困难，尤其在涉及 vectorization, RNNs, or when operating in a multi-agent environment时。RLlib提供了 [RolloutWorker](https://github.com/ray-project/ray/blob/master/rllib/evaluation/rollout_worker.py) 类，来管理所有的这些，this class is used in most RLlib algorithms。

你可以使用 rollout workers 来生成 batches of experiences，即调用`worker.sample()`,  or `worker.sample.remote()` in **parallel** on worker instances created as Ray actors (see [WorkerSet](https://github.com/ray-project/ray/blob/master/rllib/evaluation/worker_set.py)).

Here is an example of creating a set of rollout workers and using them gather experiences in parallel. The trajectories are concatenated, the policy learns on the trajectory batch, and then we broadcast the policy weights to the workers for the next round of rollouts:

```python
# Setup policy and rollout workers.
env = gym.make("CartPole-v1")
policy = CustomPolicy(env.observation_space, env.action_space, {})
workers = WorkerSet(
    policy_class=CustomPolicy,
    env_creator=lambda c: gym.make("CartPole-v1"),
    num_workers=10)

while True:
    # Gather a batch of samples.
    T1 = SampleBatch.concat_samples(
        ray.get([w.sample.remote() for w in workers.remote_workers()]))

    # Improve the policy using the T1 batch.
    policy.learn_on_batch(T1)

    # The local worker acts as a "parameter server" here.
    # We put the weights of its `policy` into the Ray object store once (`ray.put`)...
    weights = ray.put({"default_policy": policy.get_weights()})
    for w in workers.remote_workers():
        # ... so that we can broacast these weights to all rollout-workers once.
        w.set_weights.remote(weights)
```

#### Sample Batches

Whether running in a single process or a large cluster, all data in RLlib is interchanged in the form of sample batches. Sample batches encode one or more fragments of a trajectory. Typically, RLlib collects batches of size rollout_fragment_length from rollout workers, and concatenates one or more of these batches into a batch of size train_batch_size that is the input to SGD.

A typical sample batch looks something like the following when summarized. Since all values are kept in arrays, this allows for efficient encoding and transmission across the network:

```python
sample_batch = { 'action_logp': np.ndarray((200,), dtype=float32, min=-0.701, max=-0.685, mean=-0.694),
    'actions': np.ndarray((200,), dtype=int64, min=0.0, max=1.0, mean=0.495),
    'dones': np.ndarray((200,), dtype=bool, min=0.0, max=1.0, mean=0.055),
    'infos': np.ndarray((200,), dtype=object, head={}),
    'new_obs': np.ndarray((200, 4), dtype=float32, min=-2.46, max=2.259, mean=0.018),
    'obs': np.ndarray((200, 4), dtype=float32, min=-2.46, max=2.259, mean=0.016),
    'rewards': np.ndarray((200,), dtype=float32, min=1.0, max=1.0, mean=1.0),
    't': np.ndarray((200,), dtype=int64, min=0.0, max=34.0, mean=9.14)
}
```

In multi-agent mode, sample batches are collected separately for each individual policy. These batches are wrapped up together in a **MultiAgentBatch**, serving as a container for the individual agents’ sample batches.


#### Training Step Method

> It’s important to have a good understanding of the basic ray core methods before reading this section. Furthermore, we utilize concepts such as the SampleBatch (and its more advanced sibling: the MultiAgentBatch), RolloutWorker, and Algorithm, which can be read about on this page and the rollout worker reference docs.
>
>   Finally, developers who are looking to implement custom algorithms should familiarize themselves with the Policy and Model classes.

- The `training_step()` isthe method of `Algorithm` class
- When is `training_step()` invoked?
  -  `train()` method of `Algorithm`
  -  Ray Tune. `training_step()`




1. [Key Subconcepts](https://docs.ray.io/en/latest/rllib/key-concepts.html#key-subconcepts)


    一般步骤
    ```python
    def training_step(self) -> ResultDict:
        # 1. Sampling.
        train_batch = synchronous_parallel_sample(
                        worker_set=self.workers,
                        max_env_steps=self.config["train_batch_size"]
                    )

        # 2. Updating the Policy.
        train_results = train_one_step(self, train_batch)

        # 3. Synchronize worker weights.
        self.workers.sync_weights()

        # 4. Return results.
        return train_results
    ```

   1. we collect trajectory data from the environment(s):

       ```python
       train_batch = synchronous_parallel_sample(
                           worker_set=self.workers,
                           max_env_steps=self.config["train_batch_size"]
                       )
       ```
   2. The train_batch is then passed to another utility function: train_one_step.

       ```python
       train_results = train_one_step(self, train_batch)
       ```
       
       Methods like `train_one_step` and `multi_gpu_train_one_step` are used for training our Policy.

   3. Now that we updated the local policy (the copy in self.workers.local_worker), we need to make sure that the copies in all remote workers (self.workers.remote_workers) have their weights synchronized (from the local one):

       ```python
       self.workers.sync_weights()
       ```

   4. By calling `self.workers.sync_weights()`, weights are broadcasted from the local worker to the remote workers. See rollout worker reference docs for further details.

       ```python
       return train_results
       ```

       A dictionary is expected to be returned that contains the results of the training update. It maps keys of type str to values that are of type float or to dictionaries of the same form, allowing for a nested structure.

       For example, a results dictionary could map policy_ids to learning and sampling statistics for that policy:

       ```python
       {
       'policy_1': {
                       'learner_stats': {'policy_loss': 6.7291455},
                       'num_agent_steps_trained': 32
                   },
       'policy_2': {
                       'learner_stats': {'policy_loss': 3.554927},
                       'num_agent_steps_trained': 32
                   },
       }
       ```

#### [Training Step Method Utilities](https://docs.ray.io/en/latest/rllib/key-concepts.html#training-step-method-utilities)

需要搞清楚以下概念

1. Sample Batch: `SampleBatch` and `MultiAgentBatch`
2. Rollout Workers: 
3. Train Ops
4. Replay Buffers
5. Parallel Request Utilities

### [Environments](https://docs.ray.io/en/latest/rllib/rllib-env.html#environments)



## 运行

[环境配置](https://github.com/ray-project/ray/tree/master/rllib)




