---
title: "Learn Makefiles (3)"
subtitle: "Getting Advanced: Commands and execution, Variables Pt. 2"
layout: post
author: "Zhang Jian"
header-style: text
mathjax: true
tags:
  - compilation
  - make
---


## Commands and execution

### Command Echoing/Silencing

在每一个命令之前加上`@`可以禁止打印输出，你也可以在运行`make`时加上`-s`实现在每一个命令之前加上`@`的效果。

```makefile
all: 
	@echo "This make line will not be printed"
	echo "But this will"
```

### Command Execution

每个命令运行在一个新的终端中（or at least the effect is as such）。

```makefile
all: 
	cd ..
	# The cd above does not affect this line, because each command is effectively run in a new shell
	echo `pwd`

	# This cd command affects the next because they are on the same line
	cd ..;echo `pwd`

	# Same as above
	cd ..; \
	echo `pwd`
```

### Default Shell

默认的终端是`/bin/sh`，你可以通过设置`SHELL`来改变终端

```makefile 
SHELL=/bin/bash

cool:
	echo "Hello from bash"
```

### Double dollar sign

在字符串中，如果想要像bash/sh中那样使用`$`，在make中可以使用`$$`

```makefile
make_var = I am a make variable
all:
	# Same as running "sh_var='I am a shell variable'; echo $sh_var" in the shell
	sh_var='I am a shell variable'; echo $$sh_var

	# Same as running "echo I am a amke variable" in the shell
	echo $(make_var)
```

### Error handling with `-k`, `-i`, and `-`

在运行make时：加上`-k`，可以使得：make运行即使出现错误，也能够继续运行。这一般用在：需要一次性查看所有的错误

在运行命令时，加上`-`，可以忽略此命令的错误

在运行make时：加上`-i`，可以忽略所有错误

```makefile
one:
	# This error will be printed but ignored, and make will continue to run
	-false
	touch one
```

### Recursive use of make

如果要递归的调用makefile，应当使用`$(MAKE)`而不是`make`（because it will pass the make flags for you and won't itself be affected by them）。

```makefile
new_contents = "hello:\n\ttouch inside_file"
all:
	mkdir -p subdir
	printf $(new_contents) | sed -e 's/^ //' > subdir/makefile
	cd subdir && $(MAKE)

clean:
	rm -rf subdir
```

### Export, environments, and recursive make

当make启动时，其会根据当时终端中的环境变量自动创建make变量。

```makefile
# Run this with "export shell_env_var='I am an environment variable'; make"
all:
	# Print out the Shell variable
	echo $$shell_env_var

	# Print out the Make variable
	echo $(shell_env_var)
```

`export`可以将变量设置为终端环境可见
<!-- The export directive takes a variable and sets it the environment for all shell commands in all the recipes: -->

```makefile
shell_env_var=Shell env var, created inside of Make
export shell_env_var
all:
	echo $(shell_env_var)
	echo $$shell_env_var
```

当在`make`中运行`make`命令时，可以通过`export`设置变量，从而让sub-make命令也获得此变量。在下面这个例子中，`cooly`正是如此。

```makefile
new_contents = "hello:\n\techo \$$(cooly)"

all:
	mkdir -p subdir
	printf $(new_contents) | sed -e 's/^ //' > subdir/makefile
	@echo "---MAKEFILE CONTENTS---"
	@cd subdir && cat makefile
	@echo "---END MAKEFILE CONTENTS---"
	cd subdir && $(MAKE)

# Note that variables and exports. They are set/affected globally.
cooly = "The subdirectory can see me!"
export cooly
# This would nullify the line above: unexport cooly

clean:
	rm -rf subdir
```

变量必须通过`export`，才能在终端运行

```makefile
one=this will only work locally
export two=we can run subcommands with this

all: 
	@echo $(one)
	@echo $$one
	@echo $(two)
	@echo $$two
```

可以使用`.EXPORT_ALL_VARIABLES`来`export`所有变量

```makefile
.EXPORT_ALL_VARIABLES:
new_contents = "hello:\n\techo \$$(cooly)"

cooly = "The subdirectory can see me!"
# This would nullify the line above: unexport cooly

all:
	mkdir -p subdir
	printf $(new_contents) | sed -e 's/^ //' > subdir/makefile
	@echo "---MAKEFILE CONTENTS---"
	@cd subdir && cat makefile
	@echo "---END MAKEFILE CONTENTS---"
	cd subdir && $(MAKE)

clean:
	rm -rf subdir
```

### Arguments to make

make的命令参数可以参考[list of options](https://www.gnu.org/software/make/manual/make.html#Options-Summary)

你可以运行多个target，例如`make clean run test`，其会先运行目标`clean`，再运行`run`，再运行`test`


## Variables Pt. 2

### Flavors and modification

变量定义的两种形式
- recursive（使用`=`）：当命令使用到这个变量时，才会去寻找变量的定义（比如例子中的later_variable）
- simply expanded（使用`:=`）：变量定义时就直接进行展开（later_variable未被定义，直接输出为空）

```makefile
# Recursive variable. This will print "later" below
one = one ${later_variable}
# Simply expanded variable. This will not print "later" below
two := two ${later_variable}

later_variable = later

all: 
	echo $(one)
	echo $(two)
```

Simply expanded (using `:=`)可以避免循环引用的错误 

```makefile
one = hello
# one gets defined as a simply expanded variable (:=) and thus can handle appending
one := ${one} there

all: 
	echo $(one)
```

`?=` 只会设置未被定义的变量

```makefile
one = hello
one ?= will not be set
two ?= will be set

all: 
	echo $(one)
	echo $(two)
```

在末尾的空格不会被忽略，但是在开头的空格会被忽略。如果想要将变量设置为空格，可以使用`$(nullstring)`

```makefile
with_spaces = hello   # with_spaces has many spaces after "hello"
after = $(with_spaces)there

nullstring =
space = $(nullstring) # Make a variable with a single space.

all: 
	echo "$(after)"
	echo start"$(space)"end
```

没有被定义的变量为空

```makefile
all: 
	# Undefined variables are just empty strings!
	echo $(nowhere)
```

使用`+=`可以用来增加变量定义的内容

```makefile
foo := start
foo += more

all: 
	echo $(foo)
```

String Substitution 也是一个很常见的修改变量的方式。可以参考 [Text Functions](https://www.gnu.org/software/make/manual/html_node/Text-Functions.html#Text-Functions)， [Filename Functions](https://www.gnu.org/software/make/manual/html_node/File-Name-Functions.html#File-Name-Functions)

### Command line arguments and override

可以通过`override`将make命令中的变量定义进行覆盖。比如我们在这里运行：`make option_one=hi`

```makefile
# Overrides command line arguments
override option_one = did_override
# Does not override command line arguments
option_two = not_override
all: 
	echo $(option_one)
	echo $(option_two)
```

### List of commands and define

`define/endef`可以将多个命令赋值给一个变量，下面这个例子比较了两种定义方式的不同，变量one同样也是被赋值了多个命令，但是变量two的多个命令时运行在不同的shell中的

```makefile
one = export blah="I was set!"; echo $$blah

define two
export blah="I was set!"
echo $$blah
endef

all: 
	@echo "This prints 'I was set'"
	@$(one)
	@echo "This does not print 'I was set' because each command runs in a separate shell"
	@$(two)
```

### Target-specific variables

变量可以仅仅被设置给某个target，如下面的例子所示

```makefile
all: one = cool

all: 
	echo one is defined: $(one)

other:
	echo one is nothing: $(one)
```


### Pattern-specific variables

类似的，也可以将变量设置给某种target patterns

```makefile
%.c: one = cool

blah.c: 
	echo one is defined: $(one)

other:
	echo one is nothing: $(one)
```


































