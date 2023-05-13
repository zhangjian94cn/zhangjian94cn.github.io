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

### Curriculum Learning

In Curriculum learning, the environment can be set to different difficulties (or “tasks”) to allow for learning to progress through controlled phases (from easy to more difficult). RLlib comes with a basic curriculum learning API utilizing the TaskSettableEnv environment API. Your environment only needs to implement the set_task and get_task methods for this to work. You can then define an env_task_fn in your config, which receives the last training results and returns a new task for the env to be set to:

