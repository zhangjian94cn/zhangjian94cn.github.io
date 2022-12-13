---
title: "Learn Makefiles"
subtitle: "Getting Advanced (1)"
layout: post
author: "Zhang Jian"
header-style: text
mathjax: true
tags:
  - compilation
  - make
---

本文是对[Makefile Cookbook](https://makefiletutorial.com/#makefile-cookbook)的简要翻译

## Targets

### The `all` target

如果想要同时运行所有的`target`，可以使用`all` target。之所以可以这样，原因是：如果不指定target，make总是运行第一条rule。

```makefile
all: one two three

one:
	touch one
two:
	touch two
three:
	touch three

clean:
	rm -f one two three
```

### Multiple targets

当多个targets对应同一个rule时，那么每一个target都会执行此rule的commands（参考下面的例子）。其中，`$@`是[automatic variable](https://makefiletutorial.com/#automatic-variables)，其包含了target name。

```makefile
all: f1.o f2.o

f1.o f2.o:
	echo $@
# Equivalent to:
# f1.o:
#	 echo f1.o
# f2.o:
#	 echo f2.o
```

## Automatic Variables and Wildcards

`*`和`%`在make中被称为wildcards（通配符）。

### 通配符 `*`

`*`含义基本和正则表达式一致。在使用`*`的同时，最好也使用`wildcard `function，要不然可能会出现一些问题。

```makefile
# Print out file information about every .c file
print: $(wildcard *.c)
	ls -la  $?
```

- `*`可以在target，prerequisites，`wildcard` function中使用
- 注意：`*`不可以直接用于变量的定义
- 注意：如果`*`没有和任何文件匹配，那么就会直接变成字符`*`（除非你使用`wildcard` function）


```makefile
thing_wrong := *.o # Don't do this! '*' will not get expanded
thing_right := $(wildcard *.o)

all: one two three four

# Fails, because $(thing_wrong) is the string "*.o"
one: $(thing_wrong)

# Stays as *.o if there are no files that match this pattern :(
two: *.o 

# Works as you would expect! In this case, it does nothing.
three: $(thing_right)

# Same as rule three
four: $(wildcard *.o)
```

### 通配符 `%`

`%`是非常有用的，但是在某些情况下，它的用法会让人感到困惑。

- 匹配模式：`%`会匹配字符串中一个或多个字符。This match is called the stem.
- 替换模式：将匹配上的stem进行替换。
- `%`通常被使用在`rule definitions`中，此外还会被用于一些函数。

下面几节讲了一些替换的例子：

- Static Pattern Rules
- Pattern Rules
- String Substitution
- The vpath Directive

### 自动变量（Automatic Variables）



## Fancy Rules






## 


