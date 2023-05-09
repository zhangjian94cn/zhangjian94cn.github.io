---
title: "RapidJson Usage"
layout: post
author: "Zhang Jian"
header-style: text
mathjax: true
tags:
  - cpp
  - json
---

## Introduction

The project page is [here](https://github.com/Tencent/rapidjson). As it says, rapidjson is fast, portable and complete. So it is worth learning it and figuring out its realization. Let's start the journey.


## Example

Let's figure out the examples it has provided. 

### example/archiver

```cpp
template <typename Archiver>
Archiver& operator&(Archiver& ar, Student& s) {
    ar.StartObject();
    ar.Member("name") & s.name;
    ar.Member("age") & s.age;
    ar.Member("height") & s.height;
    ar.Member("canSwim") & s.canSwim;
    return ar.EndObject();
}
```

We find it uses "[template type deduction](https://www.cnblogs.com/harlanc/p/10565917.html)" to realize operator overload. But I don't understand what does the operator "&" used for. 

```cpp
// Serialize
{
    Student s("Lua", 9, 150.5, true);

    JsonWriter writer;
    writer & s; // here
    json = writer.GetString();
    std::cout << json << std::endl;
}
```

By reading this piece of code, I can guess that writer get the student's infomation and output it. But how does it realize?


This confused me. Why does class private member can be used out of class directly?
```cpp
// 
#define DOCUMENT reinterpret_cast<Document*>(mDocument)
#define STACK (reinterpret_cast<JsonReaderStack*>(mStack))
#define TOP (STACK->top())
#define CURRENT (*TOP.value)
```

This following pieces of code also confused me. I will ask for help...
```cpp
// Archive concept
JsonReader& JsonReader::StartObject() {
    if (!mError) {
        if (CURRENT.IsObject() && TOP.state == JsonReaderStackItem::BeforeStart)
            TOP.state = JsonReaderStackItem::Started;
        else
            mError = true;
    }
    return *this;
}

JsonReader& JsonReader::EndObject() {
    if (!mError) {
        if (CURRENT.IsObject() && TOP.state == JsonReaderStackItem::Started)
            Next();
        else
            mError = true;
    }
    return *this;
}

JsonReader& JsonReader::Member(const char* name) {
    if (!mError) {
        if (CURRENT.IsObject() && TOP.state == JsonReaderStackItem::Started) {
            Value::ConstMemberIterator memberItr = CURRENT.FindMember(name);
            if (memberItr != CURRENT.MemberEnd()) 
                STACK->push(JsonReaderStackItem(&memberItr->value, JsonReaderStackItem::BeforeStart));
            else
                mError = true;
        }
        else
            mError = true;
    }
    return *this;
}
```





