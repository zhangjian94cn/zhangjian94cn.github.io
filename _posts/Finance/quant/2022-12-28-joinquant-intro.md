---
title: "Finance Introduction"
layout: post
author: "Zhang Jian"
header-style: text
mathjax: true
tags:
  - finance
---

## 

- [量化交易策略基本框架](https://www.joinquant.com/view/community/detail/7fe7e01ebbe6082101b4c57a4daaac57)
- [下单、函数、API](https://www.joinquant.com/view/community/detail/7570870ccf37ba48007261992d2e543a)
- [读取context中的数据与条件判断](https://www.joinquant.com/view/community/detail/04a0251d77b31e782afa0f321c459d10)，里面比较有用的是[context的图片](https://image.joinquant.com/79e1891ccd9745dddaddc9a2cf18fa6a)
- [获取典型常用数据](https://www.joinquant.com/view/community/detail/c688e86342b472f380c8fb9fc58eec54)
![](../../../img/2022-12-28-21-31-25.png)

```python
def initialize(context):
    run_daily(period,time='every_bar')
    g.security = '000001.XSHE'

def period(context):
    order(g.security, 100)
```

<details>
<summary>bar</summary>
如果策略频率为天，是每个交易日开始生效，从9:30直到15:00（从股市开市到收市），所以例子中是每个交易日9:30开市循环就开始，一天一次地循环执行买入股票的操作。
<br>
如果策略频率为分钟，是每个分钟开始时执行，所以例子中的买入股票的操作是每个交易日从9:30:00开始，然后9:31:00，直到14:59:00。接着下一天9:30:00，如此一分钟一次地循环执行的。
minBar.png
<br>
虽然频率只有为分钟和每天可选，但通过不同的代码可以实现按周按月周期循环，而且分钟级别里下单时间也是可以自己选的，不过代码的写法则与写法一和写法二那样略有不同，后面会讲到。
</details>

基于本地api，编写了[测试代码](https://github.com/Fintech-Future/notebook/blob/main/2.code/test.py)


## 参考


