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

<!-- 
```bash
# 切换到root用户下
su
# add ssh start
echo '/etc/init.d/ssh start' >> /root/.bashrc
``` 
-->


<!-- 
https://www.linuxprobe.com/docker-ssh.html

https://www.cyberciti.biz/faq/ubuntu-linux-install-openssh-server/

https://www.yisu.com/ask/3615.html
-->

<!-- 
## 更进一步

### 基于zerotier的ssh连接


https://zerotier.atlassian.net/wiki/spaces/SD/pages/7536656/Running+ZeroTier+in+a+Docker+Container


```bash
# 
docker run -it --rm --cap-add=NET_ADMIN --cap-add=SYS_ADMIN --device=/dev/net/tun centos:7 [... command ...]
# 
curl https://install.zerotier.com/ | bash
# 
/usr/sbin/zerotier-one -d
# 
/usr/sbin/zerotier-cli join 83048a0632be90f0
```


### 如何限制docker资源

使用lxcfs限制各类资源，[参考文章](https://cloud.tencent.com/developer/article/1787372)

```bash
# https://howtoinstall.co/en/lxcfs
sudo apt-get install lxcfs

# 因为直接使用了apt install
systemctl enable lxcfs.service
systemctl start lxcfs.service

# https://blog.csdn.net/fuck487/article/details/86096134
# 实时更新docker资源
docker update --memory 8g --memory-swap -1 ssh-container
```

### 最终命令

#### 宿主机

```bash
docker run -itd \
    -p 50001:22 \
    --name="ssh-container" \
    --cap-add=NET_ADMIN \
    --cap-add=SYS_ADMIN \
    --device=/dev/net/tun \
    -v /home/share:/home \
    -v /var/lib/lxcfs/proc/cpuinfo:/proc/cpuinfo:rw \
    -v /var/lib/lxcfs/proc/diskstats:/proc/diskstats:rw \
    -v /var/lib/lxcfs/proc/meminfo:/proc/meminfo:rw \
    -v /var/lib/lxcfs/proc/stat:/proc/stat:rw \
    -v /var/lib/lxcfs/proc/swaps:/proc/swaps:rw \
    -v /var/lib/lxcfs/proc/uptime:/proc/uptime:rw \
    --memory=4g \
    --cpus=4 \
    --cpuset-cpus="0-3" \
    ubuntu:22.04 \
    /bin/bash

docker update --restart=always ssh-container

# 查看定时关机
vim /etc/crontab

```

#### 容器

```bash
# root用户模式
apt-get update && apt-get install openssh-server htop vim sudo -y
# 启动ssh服务
/etc/init.d/ssh start
# ssh服务自启动
echo '/etc/init.d/ssh start' >> /root/.bashrc
# 添加登录用户：zhangjian，添加sudo权限
export user=zhangjian && adduser $user && usermod -aG sudo $user
## install zerotier
curl https://install.zerotier.com/ | bash
# 
/usr/sbin/zerotier-one -d
# 
/usr/sbin/zerotier-cli join 83048a0632be90f0
# 
echo '/etc/init.d/zerotier-one start' >> /root/.bashrc
```

遇到一个问题，无法使用systemctl，会出现如下错误

```bash
root@39edc8b168fe:/$ sudo systemctl start zerotier-one.service
System has not been booted with systemd as init system (PID 1). Can't operate.
Failed to connect to bus: Host is down
```


-->

## 结语

至此，我们获得了一个相对完整的ssh直连容器的方案。但是更进一步，如何避免端口转发，指定容器的资源使用等等，有机会再进行分享:)


## 参考

[System has not been booted with systemd as init system (PID 1). Can't operate](https://askubuntu.com/questions/1379425/system-has-not-been-booted-with-systemd-as-init-system-pid-1-cant-operate)

[Start sshd automatically with docker container](https://stackoverflow.com/questions/22886470/start-sshd-automatically-with-docker-container)

[Ubuntu18.04 ssh 开机自动启动的设置方法](https://blog.csdn.net/hwt0101/article/details/112527027)

[Docker容器运行时权限和Linux系统功能](https://developer.aliyun.com/article/722230)

[为什么strace在Docker 中不起作用？](https://linux.cn/article-12251-1.html)


