---
title: "RLlib: User Guides"
layout: post
author: "Zhang Jian"
header-style: text
mathjax: true
tags:
  - ray
  - rl
---

## 简介

## [Advanced Python APIs](https://docs.ray.io/en/latest/rllib/rllib-advanced-api.html#advanced-python-apis)

重点在于`.trian()`的调用

In the basic training example, Tune will call `train()` on your algorithm once per training iteration and report the new training results. Sometimes, it is desirable to have full control over training, but still run inside Tune. Tune supports custom trainable functions that can be used to implement [custom training workflows (example)](https://github.com/ray-project/ray/blob/master/rllib/examples/custom_train_fn.py).

For even finer-grained control over training, you can use RLlib’s lower-level building blocks directly to implement fully customized training workflows.

### Curriculum Learning (渐进式学习)

> 这个很有意思，env可以设置不同的难度（easy to difficulty）

In Curriculum learning, the environment can be set to different difficulties (or “tasks”) to allow for learning to progress through controlled phases (from easy to more difficult). RLlib comes with a basic curriculum learning API utilizing the [TaskSettableEnv](https://github.com/ray-project/ray/blob/master/rllib/env/apis/task_settable_env.py) environment API. Your environment only needs to implement the set_task and get_task methods for this to work. You can then define an env_task_fn in your config, which receives the last training results and returns a new task for the env to be set to:

```py
from ray.rllib.env.apis.task_settable_env import TaskSettableEnv

class MyEnv(TaskSettableEnv):
    def get_task(self):
        return self.current_difficulty

    def set_task(self, task):
        self.current_difficulty = task

def curriculum_fn(train_results, task_settable_env, env_ctx):
    # Very simple curriculum function.
    current_task = task_settable_env.get_task()
    new_task = current_task + 1
    return new_task

# Setup your Algorithm's config like so:
config = {
    "env": MyEnv,
    "env_task_fn": curriculum_fn,
}
# Train using `Tuner.fit()` or `Algorithm.train()` and the above config stub.
# ...
```

还有另外两种方法实现[curriculum learning](https://bair.berkeley.edu/blog/2017/12/20/reverse-curriculum/)

```py
import ray
from ray import tune
from ray.rllib.algorithms.ppo import PPO

def train(config, reporter):
    algo = PPO(config=config, env=YourEnv)
    while True:
        result = algo.train()
        reporter(**result)
        if result["episode_reward_mean"] > 200:
            task = 2
        elif result["episode_reward_mean"] > 100:
            task = 1
        else:
            task = 0
            # lambda ev: ev.foreach_env的输入参数应当是worker本身
        algo.workers.foreach_worker(
            lambda ev: ev.foreach_env(
                lambda env: env.set_task(task)))

num_gpus = 0
num_workers = 2

ray.init()
tune.Tuner(
    tune.with_resources(train, resources=tune.PlacementGroupFactory(
        [{"CPU": 1}, {"GPU": num_gpus}] + [{"CPU": 1}] * num_workers
    ),)
    param_space={
        "num_gpus": num_gpus,
        "num_workers": num_workers,
    },
).fit()
```

也可以使用RLlib’s callbacks API来更新env

```py
import ray
from ray import tune
from ray.rllib.agents.callbacks import DefaultCallbacks

class MyCallbacks(DefaultCallbacks):
    def on_train_result(self, algorithm, result, **kwargs):
        if result["episode_reward_mean"] > 200:
            task = 2
        elif result["episode_reward_mean"] > 100:
            task = 1
        else:
            task = 0
        algorithm.workers.foreach_worker(
            lambda ev: ev.foreach_env(
                lambda env: env.set_task(task)))

ray.init()
tune.Tuner(
    "PPO",
    param_space={
        "env": YourEnv,
        "callbacks": MyCallbacks,
    },
).fit()
```

> 简单总结下，所谓Curriculum Learning本质上是对env的更新，实现对env更新有2种方式：1）env_task_fn（更新task）2）直接操作 workers（`tune.with_resources(train, ...)`，或者 回调函数）

> 看这个文档就是要学习它的设计，而不是记住它的用法

### Global Coordination （全局协调）

> 这类似于全局变量，只不过跨的范围不同，设置全局变量一直是一个很麻烦的事情，这个可以参考参考他的实现

Sometimes, it is necessary to coordinate between pieces of code that live in different processes managed by RLlib. For example, it can be useful to maintain a global average of a certain variable, or centrally control a hyperparameter used by policies. Ray provides a general way to achieve this through **named actors** (learn more about[ Ray actors here](https://docs.ray.io/en/latest/ray-core/actors.html#actor-guide)). These actors are assigned a global name and handles to them can be retrieved using these names. As an example, consider maintaining a shared global counter that is incremented by environments and read periodically from your driver program:

```py
import ray

@ray.remote
class Counter:
    def __init__(self):
        self.count = 0

    def inc(self, n):
        self.count += n

    def get(self):
        return self.count


# on the driver
counter = Counter.options(name="global_counter").remote()
print(ray.get(counter.get.remote()))  # get the latest count

# in your envs
counter = ray.get_actor("global_counter")
counter.inc.remote(1)  # async call to increment the global count
```

Ray actors provide high levels of performance, so in more complex cases they can be used implement communication patterns such as parameter servers and allreduce.

> 哈哈，就是用的ray的最基本的概念去做的，的确可以如此，这个全局变量甚至进程都是独立的 :)
> 
> ps: 这样的设计是很灵活的，有很多思考在里面

### Callbacks and Custom Metrics

> 这个感觉没啥，就是告诉你如何去设置callback，自定义metric

You can provide callbacks to be called at points during policy evaluation. These callbacks have access to state for the current [episode](https://github.com/ray-project/ray/blob/master/rllib/evaluation/episode.py). Certain callbacks such as `on_postprocess_trajectory`, `on_sample_end`, and `on_train_result` are also places where custom postprocessing can be applied to intermediate data or results.

User-defined state can be stored for the episode in the `episode.user_data` dict, and custom scalar metrics reported by saving values to the `episode.custom_metrics` dict. These custom metrics will be aggregated and reported as part of training results. For a full example, take a look at [this example script here](https://github.com/ray-project/ray/blob/master/rllib/examples/custom_metrics_and_callbacks.py) and [these unit test cases](https://github.com/ray-project/ray/blob/master/rllib/algorithms/tests/test_callbacks.py) here.

### Chaining Callbacks

### Visualizing Custom Metrics

自定义的metric也是可以可视化的

### Customizing Exploration Behavior

> 看了标题 什么是Exploration？我用加粗的部分标出来了

RLlib offers a unified top-level API to configure and customize an agent’s exploration behavior, **including the decisions (how and whether) to sample actions from distributions (stochastically or deterministically)**. The setup can be done via using built-in Exploration classes (see [this package](https://github.com/ray-project/ray/blob/master/rllib/utils/exploration/)), which are specified (and further configured) inside `AlgorithmConfig().exploration(..)`. Besides using one of the available classes, one can sub-class any of these built-ins, add custom behavior to it, and use that new class in the config instead.

> 下面这段话中，使用  `type` key 来选择要用的 class（这么写很奇怪）

Every policy has-an Exploration object, which is created from the AlgorithmConfig’s `.exploration(exploration_config=...)` method, which specifies the class to use via the special “type” key, as well as constructor arguments via all other keys, e.g.:

```py
from ray.rllib.algorithms.algorithm_config import AlgorithmConfig

config = AlgorithmConfig().exploration(
    exploration_config={
        # Special `type` key provides class information
        "type": "StochasticSampling",
        # Add any needed constructor args here.
        "constructor_arg": "value",
    }
)
```

The following table lists all built-in Exploration sub-classes and the agents that currently use these by default:

![](/img/rllib-exploration-api-table.svg)

> 这个图片是很不错的，讲了explore=True/False的区别，之前有遇到过

An Exploration class implements the `get_exploration_action` method, in which the exact exploratory behavior is defined. It takes the model’s output, the action distribution class, the model itself, a timestep (the global env-sampling steps already taken), and an explore switch and outputs a tuple of a) action and b) log-likelihood:

> 这里主要说Exploration的behavior是在`get_exploration_action`中定义的，下面的代码时这个函数的接口

```py

    @DeveloperAPI
    def get_exploration_action(self,
                               *,
                               action_distribution: ActionDistribution,
                               timestep: Union[TensorType, int],
                               explore: bool = True):
        """Returns a (possibly) exploratory action and its log-likelihood.

        Given the Model's logits outputs and action distribution, returns an
        exploratory action.

        Args:
            action_distribution: The instantiated
                ActionDistribution object to work with when creating
                exploration actions.
            timestep: The current sampling time step. It can be a tensor
                for TF graph mode, otherwise an integer.
            explore: True: "Normal" exploration behavior.
                False: Suppress all exploratory behavior and return
                a deterministic action.

        Returns:
            A tuple consisting of 1) the chosen exploration action or a
            tf-op to fetch the exploration action from the graph and
            2) the log-likelihood of the exploration action.
        """
        pass
```


On the highest level, the `Algorithm.compute_actions` and `Policy.compute_actions` methods have a boolean `explore` switch, which is passed into Exploration.`get_exploration_action`. If `explore=None`, the value of Algorithm.config[“explore”] is used, which thus serves as a main switch for exploratory behavior, allowing e.g. turning off any exploration easily for evaluation purposes (see [Customized Evaluation During Training](https://docs.ray.io/en/latest/rllib/rllib-advanced-api.html#customized-evaluation-during-training)).


### Customized Evaluation During Training

RLlib will report online training rewards, however in some cases you may want to compute rewards with different settings (e.g., with exploration turned off, or on a specific set of environment configurations). You can activate evaluating policies during training (`Algorithm.train()`) by setting the `evaluation_interval` to an int value (> 0) indicating every how many `Algorithm.train()` calls an “evaluation step” is run:

```py
# Run one evaluation step on every 3rd `Algorithm.train()` call.
{
    "evaluation_interval": 3,
}
```

> 上面这个之前涉及比较多了，设置evaluation_interval

An evaluation step runs - using its own `RolloutWorkers` for `evaluation_duration` episodes or time-steps, depending on the `evaluation_duration_unit` setting, which can take values of either "episodes" (default) or "timesteps".

> 设置evaluation_duration_unit

```py
# Every time we run an evaluation step, run it for exactly 10 episodes.
{
    "evaluation_duration": 10,
    "evaluation_duration_unit": "episodes",
}
# Every time we run an evaluation step, run it for (close to) 200 timesteps.
{
    "evaluation_duration": 200,
    "evaluation_duration_unit": "timesteps",
}
```

Note: When using `evaluation_duration_unit=timesteps` and your `evaluation_duration` setting is not divisible by the number of evaluation workers (configurable via `evaluation_num_workers`), RLlib will round up the number of time-steps specified to the nearest whole number of time-steps that is divisible by the number of evaluation workers. Also, when using `evaluation_duration_unit=episodes` and your `evaluation_duration` setting is not divisible by the number of evaluation workers (configurable via `evaluation_num_workers`), RLlib will run the remainder of episodes on the first n eval RolloutWorkers and leave the remaining workers idle for that time.

> 

```py
# Every time we run an evaluation step, run it for exactly 10 episodes, no matter, how many eval workers we have.
{
    "evaluation_duration": 10,
    "evaluation_duration_unit": "episodes",

    # What if number of eval workers is non-dividable by 10?
    # -> Run 7 episodes (1 per eval worker), then run 3 more episodes only using
    #    evaluation workers 1-3 (evaluation workers 4-7 remain idle during that time).
    "evaluation_num_workers": 7,
}
```

> 下面这一段主要在将eval的执行细节

Before each evaluation step, weights from the main model are synchronized to all evaluation workers.

By default, the evaluation step (if there is one in the current iteration) is run right after the respective training step. For example, for evaluation_interval=1, the sequence of events is: train(0->1), eval(1), train(1->2), eval(2), train(2->3), .... Here, the indices show the version of neural network weights used. train(0->1) is an update step that changes the weights from version 0 to version 1 and eval(1) then uses weights version 1. Weights index 0 represents the randomly initialized weights of our neural network(s).

Another example: For evaluation_interval=2, the sequence is: train(0->1), train(1->2), eval(2), train(2->3), train(3->4), eval(4), ....

Instead of running train- and eval-steps in sequence, it is also possible to run them in parallel via the evaluation_parallel_to_training=True config setting. In this case, both training- and evaluation steps are run at the same time via multi-threading. This can speed up the evaluation process significantly, but leads to a 1-iteration delay between reported training- and evaluation results. The evaluation results are behind in this case b/c they use slightly outdated model weights (synchronized after the previous training step).

For example, for evaluation_parallel_to_training=True and evaluation_interval=1, the sequence is now: train(0->1) + eval(0), train(1->2) + eval(1), train(2->3) + eval(2), where + means: “at the same time”. Note that the change in the weights indices with respect to the non-parallel examples above. The evaluation weights indices are now “one behind” the resulting train weights indices (train(1->**2**) + eval(**1**)).

When running with the evaluation_parallel_to_training=True setting, a special “auto” value is supported for evaluation_duration. This can be used to make the evaluation step take roughly as long as the concurrently ongoing training step:

```py
# Run evaluation and training at the same time via threading and make sure they roughly
# take the same time, such that the next `Algorithm.train()` call can execute
# immediately and not have to wait for a still ongoing (e.g. b/c of very long episodes)
# evaluation step:
{
    "evaluation_interval": 1,
    "evaluation_parallel_to_training": True,
    "evaluation_duration": "auto",  # automatically end evaluation when train step has finished
    "evaluation_duration_unit": "timesteps",  # <- more fine grained than "episodes"
}
```

> 以下`evaluation_config`的设置

The `evaluation_config` key allows you to override any config settings for the evaluation workers. For example, to switch off exploration in the evaluation steps, do:

```py
# Switching off exploration behavior for evaluation workers
# (see rllib/algorithms/algorithm.py). Use any keys in this sub-dict that are
# also supported in the main Algorithm config.
"evaluation_config": {
   "explore": False
}
```

Policy gradient algorithms are able to find the optimal policy, even if this is a stochastic one. Setting “explore=False” above will result in the evaluation workers not using this stochastic policy.


> 下面讲得不错，尤其for example部分

The level of parallelism within the evaluation step is determined via the `evaluation_num_workers` setting. Set this to larger values if you want the desired evaluation episodes or time-steps to run as much in parallel as possible. For example, if your `evaluation_duration=10`, `evaluation_duration_unit=episodes`, and `evaluation_num_workers=10`, each evaluation `RolloutWorker` only has to run one episode in each evaluation step.

> 下面这段说 evaluation还有 fault tolerant，通过设置 `enable_async_evaluation=True` 实现，也包含了一些细节

In case you observe occasional failures in your (evaluation) RolloutWorkers during evaluation (e.g. you have an environment that sometimes crashes), you can use an (experimental) new setting: `enable_async_evaluation=True`. This will run the parallel sampling of all evaluation RolloutWorkers via a fault tolerant, asynchronous manager, such that if one of the workers takes too long to run through an episode and return data or fails entirely, the other evaluation RolloutWorkers will pick up its task and complete the job.

Note that with or without async evaluation, all [fault tolerance settings](https://docs.ray.io/en/latest/rllib/rllib-training.html#rllib-scaling-guide), such as `ignore_worker_failures` or `recreate_failed_workers` will be respected and applied to the failed evaluation workers.

Here’s an example:

```py
# Having an environment that occasionally blocks completely for e.g. 10min would
# also affect (and block) training:
{
    "evaluation_interval": 1,
    "evaluation_parallel_to_training": True,
    "evaluation_num_workers": 5,  # each worker runs two episodes
    "evaluation_duration": 10,
    "evaluation_duration_unit": "episodes",
}
```

> 我有点困惑`evaluation_interval`和`evaluation_duration`的区别是什么

{

  > 这段话和我这段时间做的比较相关

  Problem with the above example:

  In case the environment used by worker 3 blocks for 10min, the entire training and evaluation pipeline will come to a (10min) halt b/c of this. The next train step cannot start before all evaluation has been finished.

  Solution:

  Switch on asynchronous evaluation, meaning, we don’t wait for individual evaluation RolloutWorkers to complete their n episode(s) (or n time-steps). Instead, any evaluation RolloutWorker can cover the load of another one that failed or is stuck in a very long lasting environment step.
  ```py
  {
      # ...
      # same settings as above, plus:
      "enable_async_evaluation": True,  # evaluate asynchronously
  }
  ```
  In case you would like to entirely customize the evaluation step, set custom_eval_function in your config to a callable, which takes the Algorithm object and a WorkerSet object (the Algorithm’s self.evaluation_workers WorkerSet instance) and returns a metrics dictionary. See algorithm.py for further documentation.

  There is also an end-to-end example of how to set up a custom online evaluation in custom_eval.py. Note that if you only want to evaluate your policy at the end of training, you can set evaluation_interval: [int], where [int] should be the number of training iterations before stopping.

  Below are some examples of how the custom evaluation metrics are reported nested under the evaluation key of normal training results:

}

### Rewriting Trajectories

> 感觉暂时用不到

Note that in the on_postprocess_traj callback you have full access to the trajectory batch (post_batch) and other training state. This can be used to rewrite the trajectory, which has a number of uses including:

- Backdating rewards to previous time steps (e.g., based on values in info).

- Adding model-based curiosity bonuses to rewards (you can train the model with a custom model supervised loss).

To access the policy / model (policy.model) in the callbacks, note that info['pre_batch'] returns a tuple where the first element is a policy and the second one is the batch itself. You can also access all the rollout worker state using the following call:

```py
from ray.rllib.evaluation.rollout_worker import get_global_worker

# You can use this from any callback to get a reference to the
# RolloutWorker running in the process, which in turn has references to
# all the policies, etc: see rollout_worker.py for more info.
rollout_worker = get_global_worker()
```

Policy losses are defined over the `post_batch` data, so you can mutate that in the callbacks to change what data the policy loss function sees.







