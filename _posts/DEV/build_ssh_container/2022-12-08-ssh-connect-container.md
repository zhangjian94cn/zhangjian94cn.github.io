---
title: "SSH Connect Docker Container"
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

如何实现ssh连接container？其步骤主要可以分为：获取宿主机IP，安装docker，运行容器（设置端口转发，容器自启动），在容器中安装ssh服务。

#### 宿主机IP

首先，你需要知道运行docker服务的IP地址，如果你没有公网IP（公有云服务器，腾讯云、阿里云都会提供），可以自己搭建一个设备的局域网（可使用zerotier）。


#### docker安装

**安装步骤如下：**

1. 首先根据自己的系统选择对应的安装方式，[官方安装的教程](https://docs.docker.com/engine/install/)。

2. 如果需要安装支持nvidia显卡的docker，还需要参考[nvidia的官方教程](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)：

3. 设置非root账号不用sudo直接执行docker命令，[参考blog](https://blog.csdn.net/boling_cavalry/article/details/106590784)

    ```bash
    # 创建名为docker的组
    sudo groupadd docker
    # 将当前用户加入组docker
    sudo gpasswd -a ${USER} docker
    # 重启docker服务(生产环境请慎用)：
    sudo systemctl restart docker
    # 添加访问和执行权限：
    sudo chmod a+rw /var/run/docker.sock
    ```

<!-- 
4. 有时候，你还需要去设置docker的代理
   
    > https://cloud.tencent.com/developer/article/1806455
-->

#### 运行容器

在运行容器之前，你需要想好：

1. 选用什么样的docker image，容器名称是什么。例如，这里使用的是：`ubuntu:22.04`，容器名称：`ssh-container`
2. 使用宿主机的什么端口，来转发容器的22端口。例如，这里使用50001端口
3. 容器目录的映射，`-v 宿主机目录:容器目录`。例如，这里挂载服务器的`/home/zhangjian`目录到容器的`/workspace`目录

操作步骤如下：

1. 首先，创建Dockerfile，其内容为：

    ```dockerfile
    FROM ubuntu:22.04
    RUN apt-get update --fix-missing && apt-get install openssh-server sudo -y
    ENTRYPOINT service ssh restar && bash
    ``` 

2. 生成对应image
    
    ```bash   
    docker build . -t ssh-image
    ```

3. 生成容器的具体的命令如下（如果其中还有一些参数让你感到困惑，你可以参考[docker run doc](https://docs.docker.com/engine/reference/commandline/run/)


    ```bash
    docker run -itd -p 50001:22 --name="ssh-container"  -v /home/zhangjian:/workspace ssh-image /bin/bash
    ```

#### 设置容器自启动

将正在运行的容器设为自启动
```bash
# docker update --restart=always 容器名或容器ID
docker update --restart=always <CONTAINER ID>
```

将自启动的容器取消自启动
```bash
# docker update --restart=no 容器名或容器ID
docker update --restart=no <CONTAINER ID>
```

#### 配置容器

<!-- ```bash
# 进入容器
docker exec -it ssh-container /bin/bash
# root用户模式
apt-get update && apt-get install openssh-server -y
# 启动ssh服务
/etc/init.d/ssh start
``` -->

设置登录用户

```bash
# 添加登录用户：zhangjian
adduser zhangjian
# 添加sudo权限
apt install sudo && usermod -aG sudo zhangjian
```

如此，你就可以使用ssh命令直接连接container了：

```bash
ssh zhangjian@<your IP> -p 50001
```

然而，为了保证重启容器之后，你仍然能使用ssh顺利登上container，你需要设置ssh服务的自启动，下面的是通过在dockerfile中加入ENTRYPOINT，实现ssh服务的自启动。

<!-- 
```bash
# 切换到root用户下
su
# add ssh start
echo '/etc/init.d/ssh start' >> /root/.bashrc
``` 
-->





```bash
docker build . -t ssh-image
docker run -itd -p 50001:22 --name="ssh-container"  -v /home/zhangjian:/workspace ubuntu:22.04 /bin/bash
```

## 结语

至此，我们获得了一个相对完整的ssh直连容器的方案。但是更进一步，如何避免端口转发，指定容器的资源使用等等，有机会再进行分享:)

