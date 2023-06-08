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



## Models, Preprocessors, and Action Distributions

> 这个非常重要，讲清楚了整个rllib的流程，当然我还可以补充下action之后的behaviour

The following diagram provides a conceptual overview of data flow between different components in RLlib. We start with an `Environment`, which - given an action - produces an observation. The observation is preprocessed by a `Preprocessor` and `Filter` (e.g. for running mean normalization) before being sent to a neural network `Model`. The model output is in turn interpreted by an `ActionDistribution` to determine the next action.

![](/img/rllib-components.svg)

The components highlighted in green can be replaced with custom user-defined implementations, as described in the next sections. The purple components are RLlib internal, which means they can only be modified by changing the algorithm source code.

### Default Behaviors

#### Built-in Preprocessors

> 这个之前自定义action的时候 也遇到过，哈哈哈 将有些变化的步骤变成pre-process也是合理的

RLlib tries to pick one of its built-in preprocessors based on the environment’s observation space. Thereby, the following simple rules apply:

- Discrete observations are one-hot encoded, e.g. `Discrete(3) and value=1 -> [0, 1, 0].` 

- MultiDiscrete observations are encoded by one-hot encoding each discrete element and then concatenating the respective one-hot encoded vectors. e.g. `MultiDiscrete([3, 4])` and `value=[1, 3] -> [0 1 0 0 0 0 1]` because the first 1 is encoded as `[0 1 0]` and the second 3 is encoded as `[0 0 0 1]`; these two vectors are then concatenated to `[0 1 0 0 0 0 1]`. 
    
  > 也就是flatted二进制编码

- Tuple and Dict observations are flattened, thereby, Discrete and MultiDiscrete sub-spaces are handled as described above. Also, the original dict/tuple observations are still available inside a) the Model via the input dict’s “obs” key (the flattened observations are in “obs_flat”), as well as b) the Policy via the following line of code (e.g. put this into your loss function to access the original observations: `dict_or_tuple_obs = restore_original_dimensions(input_dict["obs"], self.obs_space, "tf|torch")` 

  > Tuple and Dict 也被展平，其中的Discrete and MultiDiscrete sub-spaces也按照如上方式处理，original dict/tuple observations可以通过`input_dict["obs"]`获得，它给了一个样例

- For Atari observation spaces, RLlib defaults to using the [DeepMind preprocessors](https://github.com/ray-project/ray/blob/master/rllib/env/wrappers/atari_wrappers.py) (`preprocessor_pref=deepmind`). However, if the Algorithm’s config key `preprocessor_pref` is set to “rllib”, the following mappings apply for Atari-type observation spaces:

  - Images of shape `(210, 160, 3)` are downscaled to `dim x dim`, where dim is a model config key (see default Model config below). Also, you can set `grayscale=True` for reducing the color channel to 1, or `zero_mean=True` for producing -1.0 to 1.0 values (instead of 0.0 to 1.0 values by default).

  - Atari RAM observations (1D space of shape `(128, )`) are zero-averaged (values between -1.0 and 1.0).

In all other cases, no preprocessor will be used and the raw observations from the environment will be sent directly into your model.


#### Default Model Config Settings

> 讲解 default behavior for automatically constructing models，然后就是如何 customize your models

In the following paragraphs, we will first describe RLlib’s default behavior for automatically constructing models (if you don’t setup a custom one), then dive into how you can customize your models by changing these settings or writing your own model classes.

> 其实我觉得rllib完全没有必要把模型的搭建也用配置化的方式 搞一个接口出来，直接传入torch/tf的模型不好吗

By default, RLlib will use the following config settings for your models. These include options for the `FullyConnectedNetworks` (`fcnet_hiddens` and `fcnet_activation`), `VisionNetworks` (`conv_filters` and `conv_activation`), auto-RNN wrapping, auto-Attention (GTrXL) wrapping, and some special options for Atari environments:

```py
MODEL_DEFAULTS: ModelConfigDict = {
    # Experimental flag.
    # If True, user specified no preprocessor to be created
    # (via config._disable_preprocessor_api=True). If True, observations
    # will arrive in model as they are returned by the env.
    "_disable_preprocessor_api": False,
    # Experimental flag.
    # If True, RLlib will no longer flatten the policy-computed actions into
    # a single tensor (for storage in SampleCollectors/output files/etc..),
    # but leave (possibly nested) actions as-is. Disabling flattening affects:
    # - SampleCollectors: Have to store possibly nested action structs.
    # - Models that have the previous action(s) as part of their input.
    # - Algorithms reading from offline files (incl. action information).
    "_disable_action_flattening": False,

    # === Built-in options ===
    # FullyConnectedNetwork (tf and torch): rllib.models.tf|torch.fcnet.py
    # These are used if no custom model is specified and the input space is 1D.
    # Number of hidden layers to be used.
    "fcnet_hiddens": [256, 256],
    # Activation function descriptor.
    # Supported values are: "tanh", "relu", "swish" (or "silu"),
    # "linear" (or None).
    "fcnet_activation": "tanh",

    # VisionNetwork (tf and torch): rllib.models.tf|torch.visionnet.py
    # These are used if no custom model is specified and the input space is 2D.
    # Filter config: List of [out_channels, kernel, stride] for each filter.
    # Example:
    # Use None for making RLlib try to find a default filter setup given the
    # observation space.
    "conv_filters": None,
    # Activation function descriptor.
    # Supported values are: "tanh", "relu", "swish" (or "silu"),
    # "linear" (or None).
    "conv_activation": "relu",

    # Some default models support a final FC stack of n Dense layers with given
    # activation:
    # - Complex observation spaces: Image components are fed through
    #   VisionNets, flat Boxes are left as-is, Discrete are one-hot'd, then
    #   everything is concated and pushed through this final FC stack.
    # - VisionNets (CNNs), e.g. after the CNN stack, there may be
    #   additional Dense layers.
    # - FullyConnectedNetworks will have this additional FCStack as well
    # (that's why it's empty by default).
    "post_fcnet_hiddens": [],
    "post_fcnet_activation": "relu",

    # For DiagGaussian action distributions, make the second half of the model
    # outputs floating bias variables instead of state-dependent. This only
    # has an effect is using the default fully connected net.
    "free_log_std": False,
    # Whether to skip the final linear layer used to resize the hidden layer
    # outputs to size `num_outputs`. If True, then the last hidden layer
    # should already match num_outputs.
    "no_final_linear": False,
    # Whether layers should be shared for the value function.
    "vf_share_layers": True,

    # == LSTM ==
    # Whether to wrap the model with an LSTM.
    "use_lstm": False,
    # Max seq len for training the LSTM, defaults to 20.
    "max_seq_len": 20,
    # Size of the LSTM cell.
    "lstm_cell_size": 256,
    # Whether to feed a_{t-1} to LSTM (one-hot encoded if discrete).
    "lstm_use_prev_action": False,
    # Whether to feed r_{t-1} to LSTM.
    "lstm_use_prev_reward": False,
    # Whether the LSTM is time-major (TxBx..) or batch-major (BxTx..).
    "_time_major": False,

    # == Attention Nets (experimental: torch-version is untested) ==
    # Whether to use a GTrXL ("Gru transformer XL"; attention net) as the
    # wrapper Model around the default Model.
    "use_attention": False,
    # The number of transformer units within GTrXL.
    # A transformer unit in GTrXL consists of a) MultiHeadAttention module and
    # b) a position-wise MLP.
    "attention_num_transformer_units": 1,
    # The input and output size of each transformer unit.
    "attention_dim": 64,
    # The number of attention heads within the MultiHeadAttention units.
    "attention_num_heads": 1,
    # The dim of a single head (within the MultiHeadAttention units).
    "attention_head_dim": 32,
    # The memory sizes for inference and training.
    "attention_memory_inference": 50,
    "attention_memory_training": 50,
    # The output dim of the position-wise MLP.
    "attention_position_wise_mlp_dim": 32,
    # The initial bias values for the 2 GRU gates within a transformer unit.
    "attention_init_gru_gate_bias": 2.0,
    # Whether to feed a_{t-n:t-1} to GTrXL (one-hot encoded if discrete).
    "attention_use_n_prev_actions": 0,
    # Whether to feed r_{t-n:t-1} to GTrXL.
    "attention_use_n_prev_rewards": 0,

    # == Atari ==
    # Set to True to enable 4x stacking behavior.
    "framestack": True,
    # Final resized frame dimension
    "dim": 84,
    # (deprecated) Converts ATARI frame to 1 Channel Grayscale image
    "grayscale": False,
    # (deprecated) Changes frame to range from [-1, 1] if true
    "zero_mean": True,

    # === Options for custom models ===
    # Name of a custom model to use
    "custom_model": None,
    # Extra options to pass to the custom classes. These will be available to
    # the Model's constructor in the model_config field. Also, they will be
    # attempted to be passed as **kwargs to ModelV2 models. For an example,
    # see rllib/models/[tf|torch]/attention_net.py.
    "custom_model_config": {},
    # Name of a custom action distribution to use.
    "custom_action_dist": None,
    # Custom preprocessors are deprecated. Please use a wrapper class around
    # your environment instead to preprocess observations.
    "custom_preprocessor": None,

    # === Options for ModelConfigs in RLModules ===
    # The latent dimension to encode into.
    # Since most RLModules have an encoder and heads, this establishes an agreement
    # on the dimensionality of the latent space they share.
    # This has no effect for models outside RLModule.
    # If None, model_config['fcnet_hiddens'][-1] value will be used to guarantee
    # backward compatibility to old configs. This yields different models than past
    # versions of RLlib.
    "encoder_latent_dim": None,

    # Deprecated keys:
    # Use `lstm_use_prev_action` or `lstm_use_prev_reward` instead.
    "lstm_use_prev_action_reward": DEPRECATED_VALUE,
    # Deprecated in anticipation of RLModules API
    "_use_default_native_models": DEPRECATED_VALUE,

}
```

> 将model配置文件传入algo_config

The dict above (or an overriding sub-set) is handed to the Algorithm via the model key within the main config dict like so:

```py
algo_config = {
    # All model-related settings go into this sub-dict.
    "model": {
        # By default, the MODEL_DEFAULTS dict above will be used.

        # Change individual keys in that dict by overriding them, e.g.
        "fcnet_hiddens": [512, 512, 512],
        "fcnet_activation": "relu",
    },

    # ... other Algorithm config keys, e.g. "lr" ...
    "lr": 0.00001,
}
```


#### Built-in Models

> 就是说如果 no custom model is specified，rllib 就会使用默认的模型

After preprocessing (if applicable) the raw environment outputs, the processed observations are fed through the policy’s model. In case, no custom model is specified (see further below on how to customize models), RLlib will pick a default model based on simple heuristics:

> 下面的原则很简单，对于图像使用vision network，其他都用FC

- A vision network (TF or Torch) for observations that have a shape of length larger than 2, for example, `(84 x 84 x 3)`.

- A fully connected network (TF or Torch) for everything else.

These default model types can further be configured via the **model config key** inside your Algorithm config (as discussed above). Available settings are listed above and also documented in the [model catalog file](https://github.com/ray-project/ray/blob/master/rllib/models/catalog.py).

> 为什么要做flatten 感觉可能是因为ray要进行数据传输 必须得序列化

Note that for the vision network case, you’ll probably have to configure `conv_filters`, if your environment observations have custom sizes. For example, `"model": {"dim": 42, "conv_filters": [[16, [4, 4], 2], [32, [4, 4], 2], [512, [11, 11], 1]]}` for 42x42 observations. Thereby, always make sure that the last Conv2D output has an output shape of [B, 1, 1, X] ([B, X, 1, 1] for PyTorch), where B=batch and X=last Conv2D layer’s number of filters, so that RLlib can flatten it. An informative error will be thrown if this is not the case.


#### Built-in auto-LSTM, and auto-Attention Wrapper

> 就是说网络输出的结果 还可以通过配置经过 lstm/attention （毕竟rl过程是有time step的）

In addition, if you set `"use_lstm": True` or `"use_attention": True` in your model config, your model’s output will be further processed by an LSTM cell (TF or Torch), or an attention (GTrXL) network (TF or Torch), respectively. More generally, RLlib supports the use of recurrent/attention models for all its policy-gradient algorithms (A3C, PPO, PG, IMPALA), and the necessary sequence processing support is built into its policy evaluation utilities.


For fully customized RNN/LSTM/Attention-Net setups see the [Recurrent Models](https://docs.ray.io/en/latest/rllib/rllib-models.html#rnns) and [Attention Networks/Transformers](https://docs.ray.io/en/latest/rllib/rllib-models.html#attention) sections below.

It is not possible to use both auto-wrappers (lstm and attention) at the same time. Doing so will create an error.


### Customizing Preprocessors and Models

#### Custom Preprocessors and Environment Filters

> 自定义的preprocessors没了

```
Custom preprocessors have been fully deprecated, since they sometimes conflict with the built-in preprocessors for handling complex observation spaces. Please use [wrapper classes](https://github.com/Farama-Foundation/Gymnasium/tree/main/gymnasium/wrappers) around your environment instead of preprocessors. Note that the built-in default Preprocessors described above will still be used and won’t be deprecated.
```

> 如何实现 ObservationWrapper RewardWrapper

Instead of using the deprecated custom Preprocessors, you should use `gym.Wrappers` to preprocess your environment’s output (observations and rewards), but also your Model’s computed actions before sending them back to the environment.

For example, for manipulating your env’s observations or rewards, do:

```py
import gym
from ray.rllib.utils.numpy import one_hot

class OneHotEnv(gym.core.ObservationWrapper):
    # Override `observation` to custom process the original observation
    # coming from the env.
    def observation(self, observation):
        # E.g. one-hotting a float obs [0.0, 5.0[.
        return one_hot(observation, depth=5)


class ClipRewardEnv(gym.core.RewardWrapper):
    def __init__(self, env, min_, max_):
        super().__init__(env)
        self.min = min_
        self.max = max_

    # Override `reward` to custom process the original reward coming
    # from the env.
    def reward(self, reward):
        # E.g. simple clipping between min and max.
        return np.clip(reward, self.min, self.max)
```

#### Custom Models: Implementing your own Forward Logic

> model logic 是什么？看标题好像是forward的过程

If you would like to provide your own model logic (instead of using RLlib’s built-in defaults), you can sub-class either `TFModelV2` (for TensorFlow) or `TorchModelV2` (for PyTorch) and then register and specify your sub-class in the config as follows:


- Custom TensorFlow Models

  > 下面讲了 `forward()` 的参数

  Custom TensorFlow models should subclass TFModelV2 and implement the `__init__()` and `forward()` methods. `forward()` takes a dict of tensor inputs (mapping str to Tensor types), whose keys and values depend on the [view requirements](https://docs.ray.io/en/latest/rllib/rllib-sample-collection.html) of the model. Normally, this input dict contains only the current observation `obs` and an `is_training` boolean flag, as well as an optional list of RNN states. `forward()` should return the model output (of size `self.num_outputs`) and - if applicable - a new list of internal states (in case of RNNs or attention nets). You can also override extra methods of the model such as value_function to implement a custom value branch.

  Additional supervised/self-supervised losses can be added via the TFModelV2.custom_loss method:

  Once implemented, your TF model can then be registered and used in place of a built-in default one:


    ```py
    import ray
    import ray.rllib.algorithms.ppo as ppo
    from ray.rllib.models import ModelCatalog
    from ray.rllib.models.tf.tf_modelv2 import TFModelV2

    class MyModelClass(TFModelV2):
        def __init__(self, obs_space, action_space, num_outputs, model_config, name): ...
        def forward(self, input_dict, state, seq_lens): ...
        def value_function(self): ...

    ModelCatalog.register_custom_model("my_tf_model", MyModelClass)

    ray.init()
    algo = ppo.PPO(env="CartPole-v1", config={
        "model": {
            "custom_model": "my_tf_model",
            # Extra kwargs to be passed to your model's c'tor.
            "custom_model_config": {},
        },
    })
    ```

- Custom PyTorch Models

    > 和上面差不多

    Similarly, you can create and register custom PyTorch models by subclassing TorchModelV2 and implement the `__init__()` and `forward()` methods. `forward()` takes a dict of tensor inputs (mapping str to PyTorch tensor types), whose keys and values depend on the view requirements of the model. Usually, the dict contains only the current observation obs and an is_training boolean flag, as well as an optional list of RNN states. forward() should return the model output (of size self.num_outputs) and - if applicable - a new list of internal states (in case of RNNs or attention nets). You can also override extra methods of the model such as value_function to implement a custom value branch.

    Additional supervised/self-supervised losses can be added via the TorchModelV2.custom_loss method:

    See these examples of [fully connected](https://github.com/ray-project/ray/blob/master/rllib/models/torch/fcnet.py), [convolutional](https://github.com/ray-project/ray/blob/master/rllib/models/torch/visionnet.py), and [recurrent](https://github.com/ray-project/ray/blob/master/rllib/models/torch/recurrent_net.py) torch models.


    ```py
    import torch.nn as nn

    import ray
    from ray.rllib.algorithms import ppo
    from ray.rllib.models import ModelCatalog
    from ray.rllib.models.torch.torch_modelv2 import TorchModelV2

    class CustomTorchModel(TorchModelV2):
        def __init__(self, obs_space, action_space, num_outputs, model_config, name): ...
        def forward(self, input_dict, state, seq_lens): ...
        def value_function(self): ...

    ModelCatalog.register_custom_model("my_torch_model", CustomTorchModel)

    ray.init()
    algo = ppo.PPO(env="CartPole-v1", config={
        "framework": "torch",
        "model": {
            "custom_model": "my_torch_model",
            # Extra kwargs to be passed to your model's c'tor.
            "custom_model_config": {},
        },
    })
    ```

- Wrapping a Custom Model (TF and PyTorch) with an LSTM- or Attention Net

    ...

- Implementing custom Recurrent Networks

- Implementing custom Attention Networks

- Batch Normalization

- Custom Model APIs (on Top of Default- or Custom Models)

- More examples for Building Custom Models

    ```py
    class ComplexInputNetwork(TFModelV2):
        """TFModelV2 concat'ing CNN outputs to flat input(s), followed by FC(s).

        Note: This model should be used for complex (Dict or Tuple) observation
        spaces that have one or more image components.

        The data flow is as follows:

        `obs` (e.g. Tuple[img0, img1, discrete0]) -> `CNN0 + CNN1 + ONE-HOT`
        `CNN0 + CNN1 + ONE-HOT` -> concat all flat outputs -> `out`
        `out` -> (optional) FC-stack -> `out2`
        `out2` -> action (logits) and vaulue heads.
        """

        def __init__(self, obs_space, action_space, num_outputs, model_config, name):
            self.original_space = (
                obs_space.original_space
                if hasattr(obs_space, "original_space")
                else obs_space
            )

            self.processed_obs_space = (
                self.original_space
                if model_config.get("_disable_preprocessor_api")
                else obs_space
            )
            super().__init__(
                self.original_space, action_space, num_outputs, model_config, name
            )

            self.flattened_input_space = flatten_space(self.original_space)

            # Build the CNN(s) given obs_space's image components.
            self.cnns = {}
            self.one_hot = {}
            self.flatten_dims = {}
            self.flatten = {}
            concat_size = 0
            for i, component in enumerate(self.flattened_input_space):
                # Image space.
                if len(component.shape) == 3 and isinstance(component, Box):
                    config = {
                        "conv_filters": model_config["conv_filters"]
                        if "conv_filters" in model_config
                        else get_filter_config(component.shape),
                        "conv_activation": model_config.get("conv_activation"),
                        "post_fcnet_hiddens": [],
                    }
                    self.cnns[i] = ModelCatalog.get_model_v2(
                        component,
                        action_space,
                        num_outputs=None,
                        model_config=config,
                        framework="tf",
                        name="cnn_{}".format(i),
                    )
                    concat_size += int(self.cnns[i].num_outputs)
                # Discrete|MultiDiscrete inputs -> One-hot encode.
                elif isinstance(component, (Discrete, MultiDiscrete)):
                    if isinstance(component, Discrete):
                        size = component.n
                    else:
                        size = np.sum(component.nvec)
                    config = {
                        "fcnet_hiddens": model_config["fcnet_hiddens"],
                        "fcnet_activation": model_config.get("fcnet_activation"),
                        "post_fcnet_hiddens": [],
                    }
                    self.one_hot[i] = ModelCatalog.get_model_v2(
                        Box(-1.0, 1.0, (size,), np.float32),
                        action_space,
                        num_outputs=None,
                        model_config=config,
                        framework="tf",
                        name="one_hot_{}".format(i),
                    )
                    concat_size += int(self.one_hot[i].num_outputs)
                # Everything else (1D Box).
                else:
                    size = int(np.product(component.shape))
                    config = {
                        "fcnet_hiddens": model_config["fcnet_hiddens"],
                        "fcnet_activation": model_config.get("fcnet_activation"),
                        "post_fcnet_hiddens": [],
                    }
                    self.flatten[i] = ModelCatalog.get_model_v2(
                        Box(-1.0, 1.0, (size,), np.float32),
                        action_space,
                        num_outputs=None,
                        model_config=config,
                        framework="tf",
                        name="flatten_{}".format(i),
                    )
                    self.flatten_dims[i] = size
                    concat_size += int(self.flatten[i].num_outputs)

            # Optional post-concat FC-stack.
            post_fc_stack_config = {
                "fcnet_hiddens": model_config.get("post_fcnet_hiddens", []),
                "fcnet_activation": model_config.get("post_fcnet_activation", "relu"),
            }
            self.post_fc_stack = ModelCatalog.get_model_v2(
                Box(float("-inf"), float("inf"), shape=(concat_size,), dtype=np.float32),
                self.action_space,
                None,
                post_fc_stack_config,
                framework="tf",
                name="post_fc_stack",
            )

            # Actions and value heads.
            self.logits_and_value_model = None
            self._value_out = None
            if num_outputs:
                # Action-distribution head.
                concat_layer = tf.keras.layers.Input((self.post_fc_stack.num_outputs,))
                logits_layer = tf.keras.layers.Dense(
                    num_outputs,
                    activation=None,
                    kernel_initializer=normc_initializer(0.01),
                    name="logits",
                )(concat_layer)

                # Create the value branch model.
                value_layer = tf.keras.layers.Dense(
                    1,
                    activation=None,
                    kernel_initializer=normc_initializer(0.01),
                    name="value_out",
                )(concat_layer)
                self.logits_and_value_model = tf.keras.models.Model(
                    concat_layer, [logits_layer, value_layer]
                )
            else:
                self.num_outputs = self.post_fc_stack.num_outputs

        @override(ModelV2)
        def forward(self, input_dict, state, seq_lens):
            if SampleBatch.OBS in input_dict and "obs_flat" in input_dict:
                orig_obs = input_dict[SampleBatch.OBS]
            else:
                orig_obs = restore_original_dimensions(
                    input_dict[SampleBatch.OBS], self.processed_obs_space, tensorlib="tf"
                )
            # Push image observations through our CNNs.
            outs = []
            for i, component in enumerate(tree.flatten(orig_obs)):
                if i in self.cnns:
                    cnn_out, _ = self.cnns[i](SampleBatch({SampleBatch.OBS: component}))
                    outs.append(cnn_out)
                elif i in self.one_hot:
                    if "int" in component.dtype.name:
                        one_hot_in = {
                            SampleBatch.OBS: one_hot(
                                component, self.flattened_input_space[i]
                            )
                        }
                    else:
                        one_hot_in = {SampleBatch.OBS: component}
                    one_hot_out, _ = self.one_hot[i](SampleBatch(one_hot_in))
                    outs.append(one_hot_out)
                else:
                    nn_out, _ = self.flatten[i](
                        SampleBatch(
                            {
                                SampleBatch.OBS: tf.cast(
                                    tf.reshape(component, [-1, self.flatten_dims[i]]),
                                    tf.float32,
                                )
                            }
                        )
                    )
                    outs.append(nn_out)
            # Concat all outputs and the non-image inputs.
            out = tf.concat(outs, axis=1)
            # Push through (optional) FC-stack (this may be an empty stack).
            out, _ = self.post_fc_stack(SampleBatch({SampleBatch.OBS: out}))

            # No logits/value branches.
            if not self.logits_and_value_model:
                return out, []

            # Logits- and value branches.
            logits, values = self.logits_and_value_model(out)
            self._value_out = tf.reshape(values, [-1])
            return logits, []

        @override(ModelV2)
        def value_function(self):
            return self._value_out

    ```


> 其实我有点不懂的是 在我之前llm-ppo的代码中 模型的定义并没有遵循 TorchModelV2/.. 这一套，那为什么仍然可行呢

### Custom Action Distributions

Similar to custom models and preprocessors, you can also specify a custom action distribution class as follows. The action dist class is passed a reference to the `model`, which you can use to access `model.model_config` or other attributes of the model. This is commonly used to implement [autoregressive action outputs](https://docs.ray.io/en/latest/rllib/rllib-models.html#autoregressive-action-distributions).


```py
import ray
import ray.rllib.algorithms.ppo as ppo
from ray.rllib.models import ModelCatalog
from ray.rllib.models.preprocessors import Preprocessor

class MyActionDist(ActionDistribution):
    @staticmethod
    def required_model_output_shape(action_space, model_config):
        return 7  # controls model output feature vector size

    def __init__(self, inputs, model):
        super(MyActionDist, self).__init__(inputs, model)
        assert model.num_outputs == 7

    def sample(self): ...
    def logp(self, actions): ...
    def entropy(self): ...

ModelCatalog.register_custom_action_dist("my_dist", MyActionDist)

ray.init()
algo = ppo.PPO(env="CartPole-v1", config={
    "model": {
        "custom_action_dist": "my_dist",
    },
})
```

### Supervised Model Losses

You can mix supervised losses into any RLlib algorithm through custom models. For example, you can add an imitation learning loss on expert experiences, or a self-supervised autoencoder loss within the model. These losses can be defined over either policy evaluation inputs, or data read from [offline storage](https://docs.ray.io/en/latest/rllib/rllib-offline.html#input-pipeline-for-supervised-losses).


**TensorFlow**: To add a supervised loss to a custom TF model, you need to override the `custom_loss()` method. This method takes in the existing policy loss for the algorithm, which you can add your own supervised loss to before returning. For debugging, you can also return a dictionary of scalar tensors in the `metrics()` method. Here is a [runnable example](https://github.com/ray-project/ray/blob/master/rllib/examples/custom_loss.py) of adding an imitation loss to CartPole training that is defined over a [offline dataset](https://docs.ray.io/en/latest/rllib/rllib-offline.html#input-pipeline-for-supervised-losses).

**PyTorch**: There is no explicit API for adding losses to custom torch models. However, you can modify the loss in the policy definition directly. Like for TF models, offline datasets can be incorporated by creating an input reader and calling `reader.next()` in the loss forward pass.


### Self-Supervised Model Losses

You can also use the custom_loss() API to add in self-supervised losses such as VAE reconstruction loss and L2-regularization.


### Variable-length / Complex Observation Spaces

> 这个就是我在实现rlhf遇到的问题，实现可变长的 Observation Spaces

RLlib supports complex and variable-length observation spaces, including `gym.spaces.Tuple, gym.spaces.Dict`, and `rllib.utils.spaces.Repeated`. The handling of these spaces is transparent to the user. RLlib internally will insert preprocessors to insert padding for repeated elements, flatten complex observations into a fixed-size vector during transit, and unpack the vector into the structured tensor before sending it to the model. The flattened observation is available to the model as `input_dict["obs_flat"]`, and the unpacked observation as `input_dict["obs"]`.

> StructTensor-like 的图很好理解，就是把repeat的内容放到对应的key下面

To enable batching of struct observations, RLlib unpacks them in a [StructTensor-like format](https://github.com/tensorflow/community/blob/master/rfcs/20190910-struct-tensor.md). In summary, repeated fields are “pushed down” and become the outer dimensions of tensor batches, as illustrated in this figure from the StructTensor RFC.

![](/img/struct-tensor.png)

**For further information about complex observation spaces, see:**

- A custom environment and model that uses [repeated struct fields](https://github.com/ray-project/ray/blob/master/rllib/examples/complex_struct_space.py).
- The pydoc of the [Repeated space](https://github.com/ray-project/ray/blob/master/rllib/utils/spaces/repeated.py).
- The pydoc of the batched [repeated values tensor](https://github.com/ray-project/ray/blob/master/rllib/models/repeated_values.py).
- The [unit tests](https://github.com/ray-project/ray/blob/master/rllib/tests/test_nested_observation_spaces.py) for Tuple and Dict spaces.


### Variable-length / Parametric Action Spaces

> 也就是说：可变长的 Action Spaces，是通过mask来实现的

Custom models can be used to work with environments where (1) the set of valid actions v[aries per step](https://neuro.cs.ut.ee/the-use-of-embeddings-in-openai-five), and/or (2) the number of valid actions is [very large](https://arxiv.org/abs/1811.00260). The general idea is that the meaning of actions can be completely conditioned on the observation, i.e., the `a` in `Q(s, a)` becomes just a token in `[0, MAX_AVAIL_ACTIONS)` that only has meaning in the context of s. This works with algorithms in the `DQN and policy-gradient families` and can be implemented as follows:

1. The environment should return a mask and/or list of valid action embeddings as part of the observation for each step. To enable batching, the number of actions can be allowed to vary from 1 to some max number

```py
class MyParamActionEnv(gym.Env):
    def __init__(self, max_avail_actions):
        self.action_space = Discrete(max_avail_actions)
        self.observation_space = Dict({
            "action_mask": Box(0, 1, shape=(max_avail_actions, )),
            "avail_actions": Box(-1, 1, shape=(max_avail_actions, action_embedding_sz)),
            "real_obs": ...,
        })
```

2. A custom model can be defined that can interpret the `action_mask` and `avail_actions` portions of the observation. Here the model computes the action logits via the dot product of some network output and each action embedding. Invalid actions can be masked out of the softmax by scaling the probability to zero:

```py
class ParametricActionsModel(TFModelV2):
    def __init__(self,
                 obs_space,
                 action_space,
                 num_outputs,
                 model_config,
                 name,
                 true_obs_shape=(4,),
                 action_embed_size=2):
        super(ParametricActionsModel, self).__init__(
            obs_space, action_space, num_outputs, model_config, name)
        self.action_embed_model = FullyConnectedNetwork(...)

    def forward(self, input_dict, state, seq_lens):
        # Extract the available actions tensor from the observation.
        avail_actions = input_dict["obs"]["avail_actions"]
        action_mask = input_dict["obs"]["action_mask"]

        # Compute the predicted action embedding
        action_embed, _ = self.action_embed_model({
            "obs": input_dict["obs"]["cart"]
        })

        # Expand the model output to [BATCH, 1, EMBED_SIZE]. Note that the
        # avail actions tensor is of shape [BATCH, MAX_ACTIONS, EMBED_SIZE].
        intent_vector = tf.expand_dims(action_embed, 1)

        # Batch dot product => shape of logits is [BATCH, MAX_ACTIONS].
        action_logits = tf.reduce_sum(avail_actions * intent_vector, axis=2)

        # Mask out invalid actions (use tf.float32.min for stability)
        inf_mask = tf.maximum(tf.log(action_mask), tf.float32.min)
        return action_logits + inf_mask, state
```

Depending on your use case it may make sense to use [just the masking](https://github.com/ray-project/ray/blob/master/rllib/examples/models/action_mask_model.py), [just action embeddings](https://github.com/ray-project/ray/blob/master/rllib/examples/parametric_actions_cartpole.py), or [both](https://github.com/ray-project/ray/blob/master/rllib/examples/models/parametric_actions_model.py). For a runnable example of “just action embeddings” in code, check out [examples/parametric_actions_cartpole.py](https://github.com/ray-project/ray/blob/master/rllib/examples/parametric_actions_cartpole.py).

Note that since masking introduces `tf.float32.min` values into the model output, this technique might not work with all algorithm options. For example, algorithms might crash if they incorrectly process the `tf.float32.mi`n values. The cartpole example has working configurations for DQN (must set `hiddens=[]`), PPO (must disable running mean and set `model.vf_share_layers=True`), and several other algorithms. Not all algorithms support parametric actions; see the algorithm overview.

### Autoregressive Action Distributions

> 如何实现：action space(a1, a2): a2 的采样分布依赖于 a1

In an action space with multiple components (e.g., `Tuple(a1, a2)`), you might want `a2` to be conditioned on the sampled value of `a1`, i.e., `a2_sampled ~ P(a2 | a1_sampled, obs)`. Normally, `a1` and `a2` would be sampled independently, reducing the expressivity of the policy.

To do this, you need both a **custom model** that implements the autoregressive pattern, and a **custom action distribution class** that leverages that model. The [autoregressive_action_dist.py](https://github.com/ray-project/ray/blob/master/rllib/examples/autoregressive_action_dist.py) example shows how this can be implemented for a simple binary action space. For a more complex space, a more efficient architecture such as a [MADE](https://arxiv.org/abs/1502.03509) is recommended. Note that sampling a `N-part` action requires `N` forward passes through the model, however computing the log probability of an action can be done in one pass:

```py
class BinaryAutoregressiveOutput(ActionDistribution):
    """Action distribution P(a1, a2) = P(a1) * P(a2 | a1)"""

    @staticmethod
    def required_model_output_shape(self, model_config):
        return 16  # controls model output feature vector size

    def sample(self):
        # first, sample a1
        a1_dist = self._a1_distribution()
        a1 = a1_dist.sample()

        # sample a2 conditioned on a1
        a2_dist = self._a2_distribution(a1)
        a2 = a2_dist.sample()

        # return the action tuple
        return TupleActions([a1, a2])

    def logp(self, actions):
        a1, a2 = actions[:, 0], actions[:, 1]
        a1_vec = tf.expand_dims(tf.cast(a1, tf.float32), 1)
        a1_logits, a2_logits = self.model.action_model([self.inputs, a1_vec])
        return (Categorical(a1_logits, None).logp(a1) + Categorical(
            a2_logits, None).logp(a2))

    def _a1_distribution(self):
        BATCH = tf.shape(self.inputs)[0]
        a1_logits, _ = self.model.action_model(
            [self.inputs, tf.zeros((BATCH, 1))])
        a1_dist = Categorical(a1_logits, None)
        return a1_dist

    def _a2_distribution(self, a1):
        a1_vec = tf.expand_dims(tf.cast(a1, tf.float32), 1)
        _, a2_logits = self.model.action_model([self.inputs, a1_vec])
        a2_dist = Categorical(a2_logits, None)
        return a2_dist

class AutoregressiveActionsModel(TFModelV2):
    """Implements the `.action_model` branch required above."""

    def __init__(self, obs_space, action_space, num_outputs, model_config,
                 name):
        super(AutoregressiveActionsModel, self).__init__(
            obs_space, action_space, num_outputs, model_config, name)
        if action_space != Tuple([Discrete(2), Discrete(2)]):
            raise ValueError(
                "This model only supports the [2, 2] action space")

        # Inputs
        obs_input = tf.keras.layers.Input(
            shape=obs_space.shape, name="obs_input")
        a1_input = tf.keras.layers.Input(shape=(1, ), name="a1_input")
        ctx_input = tf.keras.layers.Input(
            shape=(num_outputs, ), name="ctx_input")

        # Output of the model (normally 'logits', but for an autoregressive
        # dist this is more like a context/feature layer encoding the obs)
        context = tf.keras.layers.Dense(
            num_outputs,
            name="hidden",
            activation=tf.nn.tanh,
            kernel_initializer=normc_initializer(1.0))(obs_input)

        # P(a1 | obs)
        a1_logits = tf.keras.layers.Dense(
            2,
            name="a1_logits",
            activation=None,
            kernel_initializer=normc_initializer(0.01))(ctx_input)

        # P(a2 | a1)
        # --note: typically you'd want to implement P(a2 | a1, obs) as follows:
        # a2_context = tf.keras.layers.Concatenate(axis=1)(
        #     [ctx_input, a1_input])
        a2_context = a1_input
        a2_hidden = tf.keras.layers.Dense(
            16,
            name="a2_hidden",
            activation=tf.nn.tanh,
            kernel_initializer=normc_initializer(1.0))(a2_context)
        a2_logits = tf.keras.layers.Dense(
            2,
            name="a2_logits",
            activation=None,
            kernel_initializer=normc_initializer(0.01))(a2_hidden)

        # Base layers
        self.base_model = tf.keras.Model(obs_input, context)
        self.register_variables(self.base_model.variables)
        self.base_model.summary()

        # Autoregressive action sampler
        self.action_model = tf.keras.Model([ctx_input, a1_input],
                                           [a1_logits, a2_logits])
        self.action_model.summary()
        self.register_variables(self.action_model.variables)
```

## Saving and Loading your RL Algorithms and Policies


## How To Customize Policies

This page describes the internal concepts used to implement algorithms in RLlib. You might find this useful if modifying or adding new algorithms to RLlib.

> policy做了哪些事情 加粗标出来了 也可以看policy的基类定义

Policy classes encapsulate(封装) the core numerical components of RL algorithms. This typically includes the policy model that **determines actions to take**, **a trajectory postprocessor for experiences**, and **a loss function** to improve the policy given post-processed experiences. For a simple example, see the policy gradients [policy definition](https://github.com/ray-project/ray/blob/master/rllib/algorithms/pg/pg_tf_policy.py).

> 大多数与深度学习框架的交互都被隔离到 Policy 接口，允许 RLlib 支持多个框架。 为了简化策略的定义，RLlib 包含了 Tensorflow 和 PyTorch 特定的模板。 您也可以从头开始编写自己的。 下面是一个例子：

Most interaction with deep learning frameworks is isolated to the [Policy interface](https://github.com/ray-project/ray/blob/master/rllib/policy/policy.py), allowing RLlib to support multiple frameworks. To simplify the definition of policies, RLlib includes [Tensorflow](https://docs.ray.io/en/latest/rllib/rllib-concepts.html#building-policies-in-tensorflow) and [PyTorch-specific](https://docs.ray.io/en/latest/rllib/rllib-concepts.html#building-policies-in-pytorch) templates. You can also write your own from scratch. Here is an example:

> 不同框架 其实对应的也就是 `compute_actions` 的model调用

```py
class CustomPolicy(Policy):
    """Example of a custom policy written from scratch.

    You might find it more convenient to use the `build_tf_policy` and
    `build_torch_policy` helpers instead for a real policy, which are
    described in the next sections.
    """

    def __init__(self, observation_space, action_space, config):
        Policy.__init__(self, observation_space, action_space, config)
        # example parameter
        self.w = 1.0

    def compute_actions(self,
                        obs_batch,
                        state_batches,
                        prev_action_batch=None,
                        prev_reward_batch=None,
                        info_batch=None,
                        episodes=None,
                        **kwargs):
        # return action batch, RNN states, extra values to include in batch
        return [self.action_space.sample() for _ in obs_batch], [], {}

    def learn_on_batch(self, samples):
        # implement your learning code here
        return {}  # return stats

    def get_weights(self):
        return {"w": self.w}

    def set_weights(self, weights):
        self.w = weights["w"]
```

The above basic policy, when run, will produce batches of observations with the basic `obs`, `new_obs`, `actions`, `rewards`, `dones`, and `infos` columns. There are two more mechanisms to pass along and emit extra information:

> 这个我不是很懂

**Policy recurrent state**: Suppose you want to compute actions based on the current timestep of the episode. While it is possible to have the environment provide this as part of the observation, we can instead compute and store it as part of the Policy recurrent state:

```py
def get_initial_state(self):
    """Returns initial RNN state for the current policy."""
    return [0]  # list of single state element (t=0)
                # you could also return multiple values, e.g., [0, "foo"]

def compute_actions(self,
                    obs_batch,
                    state_batches,
                    prev_action_batch=None,
                    prev_reward_batch=None,
                    info_batch=None,
                    episodes=None,
                    **kwargs):
    assert len(state_batches) == len(self.get_initial_state())
    new_state_batches = [[
        t + 1 for t in state_batches[0]
    ]]
    return ..., new_state_batches, {}

def learn_on_batch(self, samples):
    # can access array of the state elements at each timestep
    # or state_in_1, 2, etc. if there are multiple state elements
    assert "state_in_0" in samples.keys()
    assert "state_out_0" in samples.keys()
```


**Extra action info output**: You can also emit extra outputs at each step which will be available for learning on. For example, you might want to output the behaviour policy logits as extra action info, which can be used for importance weighting, but in general arbitrary values can be stored here (as long as they are convertible to numpy arrays):

```py
def compute_actions(self,
                    obs_batch,
                    state_batches,
                    prev_action_batch=None,
                    prev_reward_batch=None,
                    info_batch=None,
                    episodes=None,
                    **kwargs):
    action_info_batch = {
        "some_value": ["foo" for _ in obs_batch],
        "other_value": [12345 for _ in obs_batch],
    }
    return ..., [], action_info_batch

def learn_on_batch(self, samples):
    # can access array of the extra values at each timestep
    assert "some_value" in samples.keys()
    assert "other_value" in samples.keys()
```

### Policies in Multi-Agent

> 需要policy这个抽象 除了用来封装不同的framework以外 还可以用于multi-agent environments

Beyond being agnostic of framework implementation, one of the main reasons to have a Policy abstraction is for use in multi-agent environments. For example, the [rock-paper-scissors example](https://docs.ray.io/en/latest/rllib/rllib-env.html#rock-paper-scissors-example) shows how you can leverage the Policy abstraction to evaluate heuristic policies against learned policies.

### Building Policies in PyTorch


Defining a policy in PyTorch is quite similar to that for TensorFlow (and the process of defining a algorithm given a Torch policy is exactly the same). Here’s a simple example of a trivial torch policy ([runnable file here](https://github.com/ray-project/ray/blob/master/rllib/examples/custom_torch_policy.py)):

```py
from ray.rllib.policy.sample_batch import SampleBatch
from ray.rllib.policy.torch_policy_template import build_torch_policy

def policy_gradient_loss(policy, model, dist_class, train_batch):
    logits, _ = model.from_batch(train_batch)
    action_dist = dist_class(logits)
    log_probs = action_dist.logp(train_batch[SampleBatch.ACTIONS])
    return -train_batch[SampleBatch.REWARDS].dot(log_probs)

# <class 'ray.rllib.policy.torch_policy_template.MyTorchPolicy'>
MyTorchPolicy = build_torch_policy(
    name="MyTorchPolicy",
    loss_fn=policy_gradient_loss)
```

Now, building on the TF examples above, let’s look at how the [A3C torch policy](https://github.com/ray-project/ray/blob/master/rllib/algorithms/a3c/a3c_torch_policy.py) is defined:

```py
A3CTorchPolicy = build_torch_policy(
    name="A3CTorchPolicy",
    get_default_config=lambda: ray.rllib.algorithms.a3c.a3c.DEFAULT_CONFIG,
    loss_fn=actor_critic_loss,
    stats_fn=loss_and_entropy_stats,
    postprocess_fn=add_advantages,
    extra_action_out_fn=model_value_predictions,
    extra_grad_process_fn=apply_grad_clipping,
    optimizer_fn=torch_optimizer,
    mixins=[ValueNetworkMixin])
```

> 后面还有一些 先不写了 


## [Sample Collections and Trajectory Views](https://docs.ray.io/en/latest/rllib/rllib-sample-collection.html#sample-collections-and-trajectory-views)

### The SampleCollector Class is Used to Store and Retrieve Temporary Data

> 这个我之前观察到了 `RolloutWorkers` 中包含 `Sampler`

RLlib’s [RolloutWorkers](https://github.com/ray-project/ray/blob/master/rllib/evaluation/rollout_worker.py), when running against a live environment, use the `SamplerInput` class to interact with that environment and produce batches of experiences. The two implemented sub-classes of `SamplerInput` are `SyncSampler` and `AsyncSampler` (residing under the `RolloutWorker.sampler` property).

> `SampleCollector` 我倒是没有关注过

In case the “_use_trajectory_view_api” top-level config key is set to True (by default since version >=1.1.0), every such sampler object will use the `SampleCollector` API to store and retrieve temporary environment-, model-, and other data during rollouts (see figure below).

![](/img/rllib-sample-collection.svg)

> Policy 会告诉 Sampler 中的 SampleCollector，它(policy)需要什么（which data to store and how to present it back to the dependent methods ），这主要是通过`ViewRequirement`来实现的
> 
> 这种设计的方法可以借鉴


**Sample collection process implemented by RLlib**: The Policy’s model tells the Sampler and its SampleCollector object, which data to store and how to present it back to the dependent methods (e.g. `Model.compute_actions()`). This is done using a dict that maps strings (column names) to `ViewRequirement` objects (details see below).

The exact behavior for a single such rollout and the number of environment transitions therein are determined by the following `AlgorithmConfig.rollout(..)` args:

... 一些代码示例 就不展开了

> 通过 `RolloutWorker.sample()` 来触发单次的 rollout，

To trigger a single rollout, RLlib calls `RolloutWorker.sample()`, which returns a SampleBatch or MultiAgentBatch object representing all the data collected during that rollout. These batches are then usually further concatenated (from the `num_workers` parallelized RolloutWorkers) to form a final train batch. The size of that train batch is determined by the `train_batch_size` config parameter. Train batches are usually sent to the Policy’s `learn_on_batch` method, which handles loss- and gradient calculations, and optimizer stepping.

> 你可以定义自己的 `SampleCollector`

RLlib’s default `SampleCollector` class is the `SimpleListCollector`, which appends single timestep data (e.g. actions) to lists, then builds SampleBatches from these and sends them to the downstream processing functions. It thereby tries to avoid collecting duplicate data separately (OBS and NEXT_OBS use the same underlying list). If you want to implement your own collection logic and data structures, you can sub-class SampleCollector and specify that new class under the Algorithm’s “sample_collector” config key.

> 其实我没太懂，Policy’s Model 如何让 RolloutWorker and its SampleCollector 知道：不同方法需要什么数据。
> 他还列出了一些方法... BUT 和上面的话有什么逻辑关系？

Let’s now look at how the Policy’s Model lets the RolloutWorker and its SampleCollector know, what data in the ongoing episode/trajectory to use for the different required method calls during rollouts. These method calls in particular are: `Policy.compute_actions_from_input_dict()` to compute actions to be taken in an episode. Policy.postprocess_trajectory(), which is called after an episode ends or a rollout hit its rollout_fragment_length limit (in batch_mode=truncated_episodes), and Policy.learn_on_batch(), which is called with a “train_batch” to improve the policy.

### Trajectory View API

> 这个 Trajectory View API 目前我还没有涉及到
> trajectory view API 允许自定义模型来 define what parts of the trajectory they require in order to execute the **forward pass**
> 比如 一般的模型只需要 最后一次观测，RNN 或者 attention 模型 需要模型之前的状态

The trajectory view API allows custom models to define what parts of the trajectory they require in order to execute the forward pass. For example, in the simplest case, a model might only look at the latest observation. However, an RNN- or attention based model could look at previous states emitted by the model, concatenate previously seen rewards with the current observation, or require the entire range of the n most recent observations.

The trajectory view API lets models define these requirements and lets RLlib gather the required data for the forward pass in an efficient way.

Since the following methods all call into the model class, they are all indirectly using the trajectory view API. It is important to note that the API is only accessible to the user via the model classes (see below on how to setup trajectory view requirements for a custom model).

In particular, the methods receiving inputs that depend on a Model’s trajectory view rules are:

- `Policy.compute_actions_from_input_dict()`
- `Policy.postprocess_trajectory()` and
- `Policy.learn_on_batch()` (and consecutively: the Policy’s loss function).

> 下面这些我没怎么看

The input data to these methods can stem from either the environment (observations, rewards, and env infos), the model itself (previously computed actions, internal state outputs, action-probs, etc..) or the Sampler (e.g. agent index, env ID, episode ID, timestep, etc..). All data has an associated time axis, which is 0-based, meaning that the first action taken, the first reward received in an episode, and the first observation (directly after a reset) all have t=0.

The idea is to allow more flexibility and standardization in how a model defines required “views” on the ongoing trajectory (during action computations/inference), past episodes (training on a batch), or even trajectories of other agents in the same episode, some of which may even use a different policy.

Such a “view requirements” formalism is helpful when having to support more complex model setups like RNNs, attention nets, observation image framestacking (e.g. for Atari), and building multi-agent communication channels.

The way to define a set of rules used for making the Model see certain data is through a “view requirements dict”, residing in the Policy.model.view_requirements property. View requirements dicts map strings (column names), such as “obs” or “actions” to a ViewRequirement object, which defines the exact conditions by which this column should be populated with data.

#### View Requirement Dictionaries

#### The ViewRequirement class

#### How does RLlib determine, which Views are required?

#### Setting ViewRequirements manually in your Model

#### Setting ViewRequirements manually after Policy construction

## Replay Buffers

### Quick Intro to Replay Buffers in RL


### Replay Buffers in RLlib




### Advanced Usage



## Working With Offline Data


## Catalog (Alpha)


## Connectors (Alpha)


## RL Modules (Alpha)

> 主要是用来替代 ModelV2 的，其主要包含了3个methods

RLModule is a **neural network container** that implements three public methods: [forward_train()](https://docs.ray.io/en/latest/rllib/package_ref/doc/ray.rllib.core.rl_module.rl_module.RLModule.forward_train.html#ray.rllib.core.rl_module.rl_module.RLModule.forward_train), [forward_exploration()](https://docs.ray.io/en/latest/rllib/package_ref/doc/ray.rllib.core.rl_module.rl_module.RLModule.forward_exploration.html#ray.rllib.core.rl_module.rl_module.RLModule.forward_exploration), and [forward_inference()](https://docs.ray.io/en/latest/rllib/package_ref/doc/ray.rllib.core.rl_module.rl_module.RLModule.forward_inference.html#ray.rllib.core.rl_module.rl_module.RLModule.forward_inference). Each method corresponds to a distinct reinforcement learning phase.


[forward_exploration()](https://docs.ray.io/en/latest/rllib/package_ref/doc/ray.rllib.core.rl_module.rl_module.RLModule.forward_exploration.html#ray.rllib.core.rl_module.rl_module.RLModule.forward_exploration) handles acting and data collection, balancing **exploration** and **exploitation**. On the other hand, the [forward_inference()](https://docs.ray.io/en/latest/rllib/package_ref/doc/ray.rllib.core.rl_module.rl_module.RLModule.forward_inference.html#ray.rllib.core.rl_module.rl_module.RLModule.forward_inference) serves the learned model during evaluation, often being less stochastic.

> forward_train() 管理训练阶段，处理 用于得到loss的 相关计算，例如在 DQN 模型中学习 Q 值。

[forward_train()](https://docs.ray.io/en/latest/rllib/package_ref/doc/ray.rllib.core.rl_module.rl_module.RLModule.forward_train.html#ray.rllib.core.rl_module.rl_module.RLModule.forward_train) manages the training phase, handling calculations exclusive to computing losses, such as learning Q values in a DQN model.

### Enabling RL Modules in the Configuration

Enable RLModules by setting the `_enable_rl_module_api` flag to `True` in the configuration object.

```py
import torch
from pprint import pprint

from ray.rllib.algorithms.ppo import PPOConfig

config = (
    PPOConfig()
    .framework("torch")
    .environment("CartPole-v1")
    .rl_module(_enable_rl_module_api=True)
)

algorithm = config.build()

# run for 2 training steps
for _ in range(2):
    result = algorithm.train()
    pprint(result)
```

### Constructing RL Modules 

> 这里的 a unified way 指的是什么？

RLModule API provides **a unified way to define custom reinforcement learning models in RLlib**. This API enables you to design and implement your own models to suit specific needs.

> 可以使用 `SingleAgentRLModuleSpec` and `MultiAgentRLModuleSpec` 来 defining module objects

To maintain consistency and usability, RLlib offers a standardized approach for defining module objects for both single-agent and multi-agent reinforcement learning environments. This is achieved through the [SingleAgentRLModuleSpec](https://docs.ray.io/en/latest/rllib/package_ref/doc/ray.rllib.core.rl_module.rl_module.SingleAgentRLModuleSpec.html#ray.rllib.core.rl_module.rl_module.SingleAgentRLModuleSpec) and [MultiAgentRLModuleSpec](https://docs.ray.io/en/latest/rllib/package_ref/doc/ray.rllib.core.rl_module.marl_module.MultiAgentRLModuleSpec.html#ray.rllib.core.rl_module.marl_module.MultiAgentRLModuleSpec) classes. The built-in RLModules in RLlib follow this consistent design pattern, making it easier for you to understand and utilize these modules.

```py
import gymnasium as gym
from ray.rllib.core.rl_module.rl_module import SingleAgentRLModuleSpec
from ray.rllib.core.testing.torch.bc_module import DiscreteBCTorchModule

env = gym.make("CartPole-v1")

spec = SingleAgentRLModuleSpec(
    module_class=DiscreteBCTorchModule,
    observation_space=env.observation_space,
    action_space=env.action_space,
    model_config_dict={"fcnet_hiddens": [64]},
)

module = spec.build()
```

You can pass RLModule specs to the algorithm configuration to be used by the algorithm.

> 这个代码，将上面 module_class=DiscreteBCTorchModule，model_config_dict={"fcnet_hiddens": [64]}, 都分开传入了，observation_space和action_space则没写？

```py
import gymnasium as gym
from ray.rllib.core.rl_module.rl_module import SingleAgentRLModuleSpec
from ray.rllib.core.testing.torch.bc_module import DiscreteBCTorchModule
from ray.rllib.core.testing.bc_algorithm import BCConfigTest


config = (
    BCConfigTest()
    .environment("CartPole-v1")
    .rl_module(
        _enable_rl_module_api=True,
        rl_module_spec=SingleAgentRLModuleSpec(module_class=DiscreteBCTorchModule),
    )
    .training(model={"fcnet_hiddens": [32, 32]})
)

algo = config.build()
```

> 刚才的问题 这里给出了解答，比如 `observation_space`, `action_space` 在其他配置中会包含

For passing RLModule specs, all fields do not have to be filled as they are filled based on the described environment or other algorithm configuration parameters (i.e. ,`observation_space`, `action_space`, `model_config_dict` are not required fields when passing a custom RLModule spec to the algorithm config.)

### Writing Custom Single Agent RL Modules

> single-agent 使用 RLModule，multi-agent 使用 MultiAgentRLModule

For single-agent algorithms (e.g., PPO, DQN) or independent multi-agent algorithms (e.g., PPO-MultiAgent), use [RLModule](https://docs.ray.io/en/latest/rllib/package_ref/doc/ray.rllib.core.rl_module.rl_module.RLModule.html#ray.rllib.core.rl_module.rl_module.RLModule). For more advanced multi-agent use cases with a shared communication between agents, extend the [MultiAgentRLModule](https://docs.ray.io/en/latest/rllib/package_ref/doc/ray.rllib.core.rl_module.marl_module.MultiAgentRLModule.html#ray.rllib.core.rl_module.marl_module.MultiAgentRLModule) class.

> single-agent 作为 multi-agent 的一种特殊情况

RLlib treats single-agent modules as a special case of [MultiAgentRLModule](https://docs.ray.io/en/latest/rllib/package_ref/doc/ray.rllib.core.rl_module.marl_module.MultiAgentRLModule.html#ray.rllib.core.rl_module.marl_module.MultiAgentRLModule) with only one module. Create the multi-agent representation of all RLModules by calling [as_multi_agent()](https://docs.ray.io/en/latest/rllib/package_ref/doc/ray.rllib.core.rl_module.rl_module.RLModule.as_multi_agent.html#ray.rllib.core.rl_module.rl_module.RLModule.as_multi_agent). For example:

```py
import gymnasium as gym
from ray.rllib.core.rl_module.rl_module import SingleAgentRLModuleSpec
from ray.rllib.core.testing.torch.bc_module import DiscreteBCTorchModule

env = gym.make("CartPole-v1")
spec = SingleAgentRLModuleSpec(
    module_class=DiscreteBCTorchModule,
    observation_space=env.observation_space,
    action_space=env.action_space,
    model_config_dict={"fcnet_hiddens": [64]},
)

module = spec.build()
marl_module = module.as_multi_agent()
```

RLlib implements the following abstract framework specific base classes:

- `TorchRLModule`: For PyTorch-based RLModules.
- `TfRLModule`: For TensorFlow-based RLModules.

The minimum requirement is for sub-classes of [RLModule](https://docs.ray.io/en/latest/rllib/package_ref/doc/ray.rllib.core.rl_module.rl_module.RLModule.html#ray.rllib.core.rl_module.rl_module.RLModule) is to implement the following methods:

- `_forward_train()`: Forward pass for training.
- `_forward_inference()`: Forward pass for inference.
- `_forward_exploration()`: Forward pass for exploration.

Also the class’s constrcutor requires a dataclass config object called [RLModuleConfig](https://docs.ray.io/en/latest/rllib/package_ref/doc/ray.rllib.core.rl_module.rl_module.RLModuleConfig.html#ray.rllib.core.rl_module.rl_module.RLModuleConfig) which contains the following fields:

- **observation_space**: The observation space of the environment (either processed or raw).
- **action_space**: The action space of the environment.
- **model_config_dict**: The model config dictionary of the algorithm. Model hyper-parameters such as number of layers, type of activation, etc. are defined here.
- **catalog_class**: The Catalog object of the algorithm.

When writing RLModules, you need to use these fields to construct your model.

```py
from typing import Mapping, Any
from ray.rllib.core.rl_module.torch.torch_rl_module import TorchRLModule
from ray.rllib.core.rl_module.rl_module import RLModuleConfig
from ray.rllib.utils.nested_dict import NestedDict

import torch
import torch.nn as nn


class DiscreteBCTorchModule(TorchRLModule):
    def __init__(self, config: RLModuleConfig) -> None:
        super().__init__(config)

        input_dim = self.config.observation_space.shape[0]
        hidden_dim = self.config.model_config_dict["fcnet_hiddens"][0]
        output_dim = self.config.action_space.n

        self.policy = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, output_dim),
        )

        self.input_dim = input_dim

    def _forward_inference(self, batch: NestedDict) -> Mapping[str, Any]:
        with torch.no_grad():
            return self._forward_train(batch)

    def _forward_exploration(self, batch: NestedDict) -> Mapping[str, Any]:
        with torch.no_grad():
            return self._forward_train(batch)

    def _forward_train(self, batch: NestedDict) -> Mapping[str, Any]:
        action_logits = self.policy(batch["obs"])
        return {"action_dist": torch.distributions.Categorical(logits=action_logits)}

```

---

> 您可以强制检查传入和传出 RLModules 的数据中是否存在某些输入或输出键。 

In [RLModule](https://docs.ray.io/en/latest/rllib/package_ref/doc/ray.rllib.core.rl_module.rl_module.RLModule.html#ray.rllib.core.rl_module.rl_module.RLModule) you can enforce the checking for the existence of certain input or output keys in the data that is communicated into and out of RLModules. This serves multiple purposes:

- For the I/O requirement of each method to be self-documenting.
- For failures to happen quickly. If users extend the modules and implement something that does not match the assumptions of the I/O specs, the check reports missing keys and their expected format. For example, we always RLModule should have an `obs` key on the input batch and an output `action_dist` key as the output.

```py
class DiscreteBCTorchModule(TorchRLModule):
    ...

    @override(TorchRLModule)
    def input_specs_exploration(self) -> SpecType:
        # Enforce that input nested dict to exploration method has a key "obs"
        return ["obs"]

    @override(TorchRLModule)
    def output_specs_exploration(self) -> SpecType:
        # Enforce that output nested dict from exploration method has a key
        # "action_dist"
        return ["action_dist"]

```

> 指定参数的method 总共有6个

RLModule has two methods for each forward method, totaling 6 methods that can be override to describe the specs of the input and output of each method:

- input_specs_inference()
- output_specs_inference()
- input_specs_exploration()
- output_specs_exploration()
- input_specs_train()
- output_specs_train()

### Writing Custom Multi-Agent RL Modules (Advanced)

### Extending Existing RLlib RLModules

RLlib provides a number of RL Modules for different frameworks (e.g., PyTorch, TensorFlow, etc.). Extend these modules by inheriting from them and overriding the methods you need to customize. For example, extend `PPOTorchRLModule` and augment it with your own customization. Then pass the new customized class into the algorithm configuration.

There are two possible ways to extend existing RL Modules:

One way to extend existing RL Modules is to inherit from them and override the methods you need to customize. For example, extend `PPOTorchRLModule` and augment it with your own customization. Then pass the new customized class into the algorithm configuration to use the PPO algorithm to optimize your custom RLModule.

> 这个就是现在主要用的方法，这里虽然讲了怎么用，但是却没有讲为什么这么用

```py
class MyPPORLModule(PPORLModule):

    def __init__(self, config: RLModuleConfig):
        super().__init__(config)
        ...

# Pass in the custom RLModule class to the spec
algo_config = algo_config.rl_module(
    rl_module_spec=SingleAgentRLModuleSpec(module_class=MyPPORLModule)
)
```


## Fault Tolerance And Elastic Training


## How To Contribute to RLlib


## Working with the RLlib CLI








