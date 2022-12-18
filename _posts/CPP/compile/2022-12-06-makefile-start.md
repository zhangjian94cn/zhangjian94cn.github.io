---
title: "Learn Makefiles (1)"
subtitle: "Getting Started"
layout: post
author: "Zhang Jian"
header-style: text
mathjax: true
tags:
  - compilation
  - make
---

本文是对[Makefile Cookbook](https://makefiletutorial.com/#makefile-cookbook)的简要翻译

### 为什么需要makefile

makefile用于决定一个大型的程序的哪一部分需要被重新编译。在大部分的情况下，其被用来编译c或c++文件。其他语言通常有自己的工具，其用途与make类似。此外，当一部分文件出现变化，你需要根据这些文件运行一系列指令时，也可以使用make。当然，本教程主要关注c/c++的编译。

<!-- 下面是一个依赖图，如果其中任何一个文件的依赖出现变化，其都需要被重新编译。 -->


### make的版本

在这里我们主要考虑GNU Make。

### 运行样例

让我们运行一个最简单的样例：新建文件夹，在其中创建`Makefile`文件，其文件内容如下：

> **需要注意：makefile中必须使用tab进行缩进**

```makefile
hello:
	echo "Hello, World"
```

在当前文件夹中运行make，结果如下：

```bash
$ make
echo "Hello, World"
Hello, World
```

### makefile的语法

makefile由一系列的rule构成，一个rule的范式如下：

```makefile
targets: prerequisites
	command
	command
	command
```

- `targets`: 文件名，通过空格进行分隔。通常，一个rule只有一个`target`
- `commands`: 一系列用于编译targets的指令。需要使用tab缩进。
- `prerequisites`: 也是文件名，通过空格进行分隔。其代表了“在运行命令（`command`）时的依赖项”

### make的本质

来看一个简单的例子，

```makefile
hello:
	echo "Hello, World"
	echo "This line will always print, because the file hello does not exist."
```

- 我们有一个`target`: hello
- 这个`target`有两个`command`
- 这个`target`没有任何依赖

让我们来运行`make`。只要**hello**不存在，这些`command`（echo ...）就会运行，反之则不运行。

需要认识到的是：**hello**同时代表了target hello和file hello，这两者的联系非常紧密。通常来说，当我们运行一个`target`的命令时，这些命令将会创建一个和`target`同名的文件。而在这个例子中，我们并没有创建file hello。

让我们来创建一个更加典型的makefile —— 编译一个单独的c文件。首先，我们需要创建blah.c，其包含如下内容：

```c
// blah.c
int main() { return 0; }
```

创建`Makefile`

```makefile
blah:
	cc blah.c -o blah
```

运行`make`。由于target blah没有依赖于其他target，因此第一个target被直接运行。当你一次运行`make`时，blah被创建。而如果你再次运行`make`，你将会看到`make: 'blah' is up to date`。这是因为`blah`已经存在了。然而，这导致了一个问题，当我们修改了`blah.c`时，没有任何东西会被重新编译。

通过加入prerequisite，可以解决这个问题：

```makefile
blah: blah.c
	cc blah.c -o blah
```

当我们再次运行make时，下面的这些步骤将会被执行：

- 第一个`target`将会被选中，因为第一个`target`时默认的`target`
- prerequisite `blah.c`是否存在
- 决定是否需要运行此`target`。只有当`blah.c`的文件修改时间在`blah`之后的时候才会运行。

最后一步是非常重要的，这也是**make的本质**。简单来说，就是当prerequisites在上次编译之后出现了变化，就需要重新编译，反之则不需要。


### 更多的例子

下面`Makefile`最终运行了3个`target`。当你在终端中运行`make`，它将会通过以下几个步骤去构建一个程序：

- 首先选择了`blah` target
- `blah` target需要`blah.o`，因此搜索`blah.o` target
- `blah.o` target需要`blah.c`，因此搜索`blah.c` target
- `blah.c`没有任何依赖，因此`echo`被运行
- 命令`cc -c`运行
- 命令`cc`运行
- 最终，`blah`生成了


```makefile
blah: blah.o
	cc blah.o -o blah # Runs third

blah.o: blah.c
	cc -c blah.c -o blah.o # Runs second

# Typically blah.c would already exist, but I want to limit any additional required files
blah.c:
	echo "int main() { return 0; }" > blah.c # Runs first
```

下面这个例子中的两个target总是会被运行。（why？）

```makefile
some_file: other_file
	echo "This will always run, and runs second"
	touch some_file

other_file:
	echo "This will always run, and runs first"
```

### Make clean

clean的语法如下，当你运行`make clean`时，`clean:`中的内容就会生效

```makefile
some_file: 
	touch some_file

clean:
	rm -f some_file
```

### 变量

变量只能是strings，一般来说会使用`:=`，`=`也可以，例如

```makefile
files := file1 file2
some_file: $(files)
	echo "Look at this variable: " $(files)
	touch some_file

file1:
	touch file1
file2:
	touch file2

clean:
	rm -f file1 file2 some_file
```

单引号，双引号对Make来说没有意义，它们会被简单的赋值给变量。而对于bash/shell来说，引号则是有用的，参考下面的例子：

```makefile
a := one two # a is assigned to the string "one two"
b := 'one two' # Not recommended. b is assigned to the string "'one two'"
all:
	printf '$a'
	printf $b
```

引用变量可以使用：`${} $()`

```makefile
x := dude

all:
	echo $(x)
	echo ${x}

	# Bad practice, but works
	echo $x 
```









