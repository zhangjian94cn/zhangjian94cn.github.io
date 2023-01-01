---
title: "How to encrypt your website"
layout: post
author: "Zhang Jian"
header-style: text
mathjax: true
tags:
  - web
---

## 方法

- [install npm](https://www.digitalocean.com/community/tutorials/how-to-install-node-js-on-ubuntu-20-04)

- 参考[这个项目](https://github.com/robinmoisson/staticrypt)，生成加密的html

- 嵌入jekyll中去，[Jekyll website with Staticrypt protected post, Where to put the encrypted.html?](https://stackoverflow.com/questions/63971731/jekyll-website-with-staticrypt-protected-post-where-to-put-the-encrypted-html)


Here's what I did:

- Put the index_encrypted.html in _includes and _layouts
- Add a permalink: /index_encrypted.html in front matter of the .md post you're targetting.
- Add a layout: index_encrypted in front matter of the .md post you're targetting.
- Delete the whole markdown content of the .md post.
- Voila!

You front matter should look like this:
```markdown
---
title: 
date: 
tags: 
description: 
layout: index_encrypted
permalink: "/index_encrypted.html"
---
```
Edit: Make sure to create a copy of your .md post for later use.

但是看[官方文档](https://jekyllrb.com/docs/permalinks/)，发现permalink只是用来改变生成html的路径，因此，并不需要在_includes中也添加路径，只要存一份就好了

