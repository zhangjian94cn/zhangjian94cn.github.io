---
title: "How to build your website"
layout: post
author: "Zhang Jian"
header-style: text
mathjax: true
tags:
  - web
---

## Introduction

想要成为全栈工程师，需要掌握多种技能，并能够把它们整合在一起，以构建完整的web应用程序。以下是一些步骤，来成为全栈工程师：

1. 掌握基础知识
全栈工程师需要掌握多种语言和技术，包括HTML、CSS、JavaScript、数据库、服务器端编程等。要成为全栈工程师，首先要学习这些基础知识。

2. 学习前端技术
前端技术是网站开发中最重要的部分之一，包括HTML、CSS、JavaScript等。全栈工程师需要熟悉页面布局、样式设计、交互效果等，能够使用一些前端框架和库快速地开发用户界面。

3. 学习后端技术
后端技术包括服务器端编程、数据库设计、API编写等。全栈工程师需要熟悉服务器端编程语言（如Node.js、Python、Ruby等），掌握数据库设计和管理技术，以及了解API设计原则和RESTful架构等。

4. 学习安全性
全栈工程师需要熟悉安全性的概念和实践，包括使用HTTPS协议、防范SQL注入、跨站脚本攻击等。

5. 练习项目经验
全栈工程师需要对如何将前端和后端整合在一起有足够的经验。为了练习这个技能，可以通过编写简单的项目来实践，例如制作一个博客系统。

### 设置开机启动

cron定时任务 我已经使用过了，还是很不错的


**方法一：使用cron定时任务**

1. 编辑cron定时任务文件：
   打开终端，并以root权限编辑cron定时任务文件。在终端中输入以下命令：

   ```bash
   sudo crontab -e
   ```

2. 在打开的编辑器中添加一行：
   在编辑器中添加以下内容，这将在开机时运行你的脚本。假设你的脚本位于`/path/to/your_script.sh`：

   ```
   @reboot /bin/bash /path/to/your_script.sh
   ```

   保存并退出编辑器。

**方法二：使用系统d服务**

1. 创建一个.service文件：
   在`/etc/systemd/system/`目录下创建一个以`.service`为扩展名的文件，例如`your_script.service`。

   ```bash
   sudo nano /etc/systemd/system/your_script.service
   ```

2. 编辑.service文件：
   在打开的编辑器中添加以下内容，替换`your_script`和`/path/to/your_script.sh`为你的脚本名称和路径。

   ```plaintext
   [Unit]
   Description=Your Script Service
   After=network.target

   [Service]
   Type=simple
   ExecStart=/bin/bash /path/to/your_script.sh

   [Install]
   WantedBy=multi-user.target
   ```

   保存并退出编辑器。

3. 启用并运行服务：
   执行以下命令启用和运行你的服务：

   ```bash
   sudo systemctl enable your_script.service
   sudo systemctl start your_script.service
   ```






## Reference

搭建自己的图床
https://cloud.tencent.com/developer/article/1789847

使用 flexget 实现下载更新自动化
https://einverne.github.io/post/2020/02/flexget.html

如何实现linux下的代理服务
1. 主机的代理
2. docker容器的代理

主要使用：[clash](https://github.com/Dreamacro/clash)，虽然docker也提供了给容器代理的[方案](https://docs.docker.com.zh.xy2401.com/network/proxy/)，但是实际使用总是无法成功，故而直接在容器内部直接使用clash。具体使用clash的方法，主要参考的是这篇[教程](https://blog.iswiftai.com/posts/clash-linux/)，在ubuntu系统中，需要打开setting中的proxy


[如何搭建vscode server服务](https://github.com/coder/code-server)，最好还是使用docker比较方便

之后要学习下使用docker compose，进行多个容器的部署


## 2024 01 24, Wednesday, 19:56:07

记录一次重新恢复服务器的翻墙的过程

### clash

1. 第一个问题

   因为之前是直接使用的service，可以查看 `vim /etc/systemd/system/clash.service`

   里面的内容如下：

   ```s
   [Unit]
   Description=Clash daemon, A rule-based proxy in Go.
   After=network.target

   [Service]
   Type=simple
   Restart=always
   ExecStart=/usr/local/bin/clash -d /home/zhangjian/.config/clash

   [Install]
   WantedBy=multi-user.target
   ```
   注意到其中是有个-d的，后面原来跟的是/etc/clash，然后我就猜测这个就是为什么
   我直接运行clash可以，但是运行clash服务总出问题的原因，因为我也`which clash`
   可执行文件路径是没有问题的

2. 第二个问题

   git clone总是不成功，于是我猜测是不是socks5和http的端口应该分开，这个是在
   /home/zhangjian/.config/clash/config.yaml当中设置，但是目前看没有问题

### github

主要是参考这个链接
https://gist.github.com/laispace/666dd7b27e9116faece6

试了其中的很多都不行，最后是通过这个解决的：
```bash
Host github.com
    Hostname ssh.github.com
    Port 443
    User git
```

这个是GPT的解释

这段配置是针对 SSH 客户端的，通常位于用户的 SSH 配置文件 `~/.ssh/config` 中。这个配置指示 SSH 如何连接到 `github.com`，并且它适用于某些特定的情况，比如：

1. **防火墙或网络限制**：有些公司或组织可能会阻止标准的 SSH 端口（22端口），这个配置使得 SSH 连接通过 443 端口，这是 HTTPS 通常使用的端口，很少被阻止。

2. **使用 HTTPS 端口转发 SSH 流量**：GitHub 允许通过 HTTPS 端口（443）来转发 SSH 连接，以帮助那些无法通过标准端口 22 进行 SSH 连接的用户。

这段配置的含义是：

- `Host github.com`：这是一个别名，指定了以下配置适用于对 `github.com` 的 SSH 连接。
- `Hostname ssh.github.com`：这实际上是 GitHub 服务器的主机名，专门用于通过 443 端口接收 SSH 连接。
- `Port 443`：这告诉 SSH 客户端使用 443 端口而不是默认的 SSH 端口 22。
- `User git`：GitHub 要求所有通过 SSH 连接的用户都使用 `git` 作为用户名。

当你尝试通过 SSH 连接到 GitHub（如 `ssh -T git@github.com`）时，SSH 客户端会查看这个配置文件，根据配置建立连接。如果你的网络环境不允许通过标准的 SSH 端口 22 连接，这样的配置可以帮助你绕过这些限制。



