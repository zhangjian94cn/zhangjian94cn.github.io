---
title: "TBB Sample 01"
subtitle: "Count Strings"
layout: post
author: "Zhang Jian"
header-style: text
mathjax: true
tags:
  - hpc
  - tbb
---

## 简介

The example counts the number of unique words in a text. [code](https://github.com/oneapi-src/oneTBB/tree/master/examples/concurrent_hash_map/count_strings)


## 细节


### 重载hash

```cpp
namespace std {

template <typename CharT, typename Traits, typename Allocator>
class hash<std::basic_string<CharT, Traits, Allocator>> {
public:
    std::size_t operator()(const std::basic_string<CharT, Traits, Allocator>& s) const {
        std::size_t h = 0;
        for (const CharT* c = s.c_str(); *c; ++c) {
            h = h * hash_multiplier ^ char_hash(*c);
        }
        return h;
    }

private:
    static constexpr std::size_t hash_multiplier = (std::size_t)(
        (sizeof(std::size_t) == sizeof(unsigned)) ? 2654435769U : 11400714819323198485ULL);

    std::hash<CharT> char_hash;
}; // strunt hash<std::basic_string>

} // namespace std
```

注意点：

1. 计算自定义类型的hash value
  1. `std::hash<CharT> char_hash`：其提供了`CharT`类型的hash值
  2. `std::size_t operator()`：通过重载运算符`()`，返回自定义类型的hash value
2. class hash的定义
   1. `class hash<std::basic_string<...>>`：模板特化为`std::basic_string`类型
   2. `<CharT, Traits, Allocator>`：模板类型推断


### 定义`MyString`类，

```cpp
//! String type
typedef std::basic_string<char, std::char_traits<char>, oneapi::tbb::tbb_allocator<char>> MyString;
```

注意点：

1. `char_traits`
  > Traits 是一个用来携带信息的很小的对象（或结构）， 在其他对象或算法中用这一信息来确定策略或实现细节。

1. `tbb_allocator`：在多线程的环境下，多个线程使用相邻内存时会产生频繁的缓存切换（csapp）,通过使用`tbb_allocator`，可以避免这一问题
   
### 并行Hash Map

```cpp
//! A concurrent hash table that maps strings to ints.
typedef oneapi::tbb::concurrent_hash_map<MyString, int> StringTable;

//! Function object for counting occurrences of strings.
struct Tally {
    StringTable& table;
    Tally(StringTable& table_) : table(table_) {}
    void operator()(const oneapi::tbb::blocked_range<MyString*> range) const {
        for (MyString* p = range.begin(); p != range.end(); ++p) {
            StringTable::accessor a;
            table.insert(a, *p);
            a->second += 1;
        }
    }
};
```

注意点:

1. [`concurrent_hash_map`](https://oneapi-src.github.io/oneTBB/main/tbb_userguide/concurrent_hash_map.html): 一个支持并行的hash map

2. `oneapi::tbb::blocked_range<...>`: 
   1. 模板参数设置**迭代（传入数据的）类型**
   2. `tbb::parallel_for`会调用`Tally(table)`的`operator()`，`blocked_range`作为参数传入
      ```cpp
      StringTable table;
      oneapi::tbb::parallel_for( 
        oneapi::tbb::blocked_range<MyString*>(Data, Data + N, 1000), 
        Tally(table));
      ```

3. [`StringTable::accessor`](https://oneapi-src.github.io/oneTBB/main/tbb_userguide/concurrent_hash_map.html):

    > An accessor represents update (write) access. As long as it points to an element, all other attempts to look up that key in the table block until the accessor is done. 

    `a->second += 1`代表对value加1

## 结语

这份代码样例展示了基于tbb的并行hash的实现，包含了tbb的一些基础用法，具有一定参考价值。


