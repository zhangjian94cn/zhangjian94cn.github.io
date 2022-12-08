---
title: "ssh直连docker容器"
layout: post
author: "Zhang Jian"
header-style: text
mathjax: true
tags:
  - dev
  - docker
---

## 简介

使用ssh直接连接到docker的容器中是一件很有价值的事情，例如你在部署vscode远程服务时，可以在保证容器与宿主机环境隔离同时，使得vscode对容器的存在完全无感。接下来，我们简单介绍下如何实现ssh直连docker容器。

## 方法

### docker安装

1. 首先根据自己的系统选择对应的安装方式，官方安装的教程如下：

    > https://docs.docker.com/engine/install/

2. 如果需要安装支持nvidia显卡的docker，还需要参考下面的教程：

    > https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html

3. 设置非root账号不用sudo直接执行docker命令

    > https://blog.csdn.net/boling_cavalry/article/details/106590784

4. 有时候，你需要去设置docker的代理
   
    > https://cloud.tencent.com/developer/article/1806455


### ssh直连

```bash
docker run -itd -p 50001:22 --name ssh systemd /bin/bash
```

https://www.linuxprobe.com/docker-ssh.html

https://www.cyberciti.biz/faq/ubuntu-linux-install-openssh-server/

https://www.yisu.com/ask/3615.html