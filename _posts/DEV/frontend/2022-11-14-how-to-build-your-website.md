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





