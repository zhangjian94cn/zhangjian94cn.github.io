---
title: "TBB Sample 01: Count Strings"
subtitle: "The example counts the number of unique words in a text"
layout: post
author: "Zhang Jian"
header-style: text
mathjax: true
tags:
  - hpc
  - tbb
---

## 简介


## 

定义了`MyString`类，

```cpp
//! String type
typedef std::basic_string<char, std::char_traits<char>, oneapi::tbb::tbb_allocator<char>> MyString;
```

其中`char_traits`

> **The char_traits struct describes attributes associated with a character.**

> The template struct describes various character traits for type CharType. The template class basic_string as well as several iostream template classes, including basic_ios, use this information to manipulate elements of type CharType.


