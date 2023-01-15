---
title: "How to build your website"
layout: post
author: "Zhang Jian"
header-style: text
mathjax: true
tags:
  - web
---



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