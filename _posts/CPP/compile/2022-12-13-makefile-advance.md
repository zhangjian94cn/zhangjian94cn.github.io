---
title: "Learn Makefiles (2)"
subtitle: "Getting Advanced: Targets, Automatic Variables and Wildcards, Fancy Rules"
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

[automatic variables](https://www.gnu.org/software/make/manual/html_node/Automatic-Variables.html)有很多，下面几个是比较常用的：

```makefile
hey: one two
	# Outputs "hey", since this is the target name
	echo $@

	# Outputs all prerequisites newer than the target
	echo $?

	# Outputs all prerequisites
	echo $^

	touch hey

one:
	touch one

two:
	touch two

clean:
	rm -f hey one two
```

## Fancy Rules

### Implicit Rules

下面的几个命令都是make中的隐式命令：
- C程序的编译：blah.o自动由blah.c编译得到，其命令如下：`$(CC) -c $(CPPFLAGS) $(CFLAGS) $^ -o $@`
- C++程序的编译：blah.o自动由blah.cc/blah.cpp编译得到，其命令如下：`$(CXX) -c $(CPPFLAGS) $(CXXFLAGS) $^ -o $@`
- 目标文件的链接：可执行文件blah自动由blah.o生成，其命令如下`$(CC) $(LDFLAGS) $^ $(LOADLIBES) $(LDLIBS) -o $@`

下面是一个编译C程序的例子，仔细观察其Implicit Rules的使用。
```makefile
CC = gcc # Flag for implicit rules
CFLAGS = -g # Flag for implicit rules. Turn on debug info

# Implicit rule #1: blah is built via the C linker implicit rule
# Implicit rule #2: blah.o is built via the C compilation implicit rule, because blah.c exists
blah: blah.o

blah.c:
	echo "int main() { return 0; }" > blah.c

clean:
	rm -f blah*
```

其中，有一些比较重要的变量：

- CC: Program for compiling C programs; default cc
- CXX: Program for compiling C++ programs; default g++
- CFLAGS: Extra flags to give to the C compiler
- CXXFLAGS: Extra flags to give to the C++ compiler
- CPPFLAGS: Extra flags to give to the C preprocessor
- LDFLAGS: Extra flags to give to compilers when they are supposed to invoke the linker

### Static Pattern Rules

形式如下：
```makefile
targets...: target-pattern: prereq-patterns ...
   commands
```

通过target-pattern（使用通配符`%`）来匹配target，符合的target会对应于prereq-patterns

接下来，让我们通过一个例子来比较下是否使用Static Pattern Rules的区别：

```makefile
# 未使用的
objects = foo.o bar.o all.o
all: $(objects)

# These files compile via implicit rules
foo.o: foo.c
bar.o: bar.c
all.o: all.c

all.c:
	echo "int main() { return 0; }" > all.c

%.c:
	touch $@

clean:
	rm -f *.c *.o all
```


```makefile
# 使用了static pattern rule的，Makefile会更加简洁
objects = foo.o bar.o all.o
all: $(objects)

# These files compile via implicit rules
# Syntax - targets ...: target-pattern: prereq-patterns ...
# In the case of the first target, foo.o, the target-pattern matches foo.o and sets the "stem" to be "foo".
# It then replaces the '%' in prereq-patterns with that stem
$(objects): %.o: %.c

all.c:
	echo "int main() { return 0; }" > all.c

%.c:
	touch $@

clean:
	rm -f *.c *.o all
```

### Static Pattern Rules and Filter

（target-pattern不是已经起到filter作用吗？为什么还需要filter function？）

```makefile
obj_files = foo.result bar.o lose.o
src_files = foo.raw bar.c lose.c

all: $(obj_files)
# Note: PHONY is important here. Without it, implicit rules will try to build the executable "all", since the prereqs are ".o" files.
.PHONY: all 

# Ex 1: .o files depend on .c files. Though we don't actually make the .o file.
$(filter %.o,$(obj_files)): %.o: %.c
	echo "target: $@ prereq: $<"

# Ex 2: .result files depend on .raw files. Though we don't actually make the .result file.
$(filter %.result,$(obj_files)): %.result: %.raw
	echo "target: $@ prereq: $<" 

%.c %.raw:
	touch $@

clean:
	rm -f $(src_files)
```



### Pattern Rules

Pattern rules一般会在下面两种情况下出现：
1. 定义自己的implicit rules
2. 形式更简单的static pattern rules

下面是两个简单的例子：
```makefile
# Define a pattern rule that compiles every .c file into a .o file
%.o : %.c
		$(CC) -c $(CFLAGS) $(CPPFLAGS) $< -o $@
```

```makefile
# Define a pattern rule that has no pattern in the prerequisites.
# This just creates empty .c files when needed.
%.c:
   touch $@
```

### Double-Colon Rules

双冒号规则很少被使用，它可以允许对一个target定义多个rule。而如果你直接对一个target使用单引号定义多个规则，那么会出现警告（and only the second set of commands would run.）。

```makefile
all: blah

blah::
	echo "hello"

blah::
	echo "hello again"
```

