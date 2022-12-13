---
title: "XGBoost Model Parser"
layout: post
author: "Zhang Jian"
header-style: text
mathjax: true
tags:
  - xgboost
  - work
  - weekly
---

## 1. Preparation


**Use simple tree as an example**

![](/img/20221114164252.png) 

### 1.1 model json detail

```json
{
    "trees": [
        {
            "base_weights": [
                7.701197E-1,
                9.783609E-2,
                7.781233E-3
            ],
            "split_conditions": [
                1.1170274E0,
                9.783609E-2,
                7.781233E-3
            ],
        }
    ]
}

```

what is base weight?

<img src="/img/20221118093230.png" width = "400" alt="图片名称"/>


### 1.2 Visualize it and figure out nodes arrangement
    
    ![](/img/20221114164252.png) 

    in memory (vector), nodes are stored as below:

    ```
    booster[0]:
    0:[f28<-9.53674316e-07] yes=1,no=2,missing=1
        1:[f55<-9.53674316e-07] yes=3,no=4,missing=3
            3:[f59<-9.53674316e-07] yes=7,no=8,missing=7
                7:leaf=1.89899647
                8:leaf=-1.94736838
            4:[f20<-9.53674316e-07] yes=9,no=10,missing=9
                9:leaf=1.78378379
                10:leaf=-1.98135197
        2:[f108<-9.53674316e-07] yes=5,no=6,missing=5
            5:[f66<-9.53674316e-07] yes=11,no=12,missing=11
                11:leaf=-1.9854598
                12:leaf=0.938775539
            6:leaf=1.87096775
    booster[1]:
    0:[f28<-9.53674316e-07] yes=1,no=2,missing=1
        1:[f20<-9.53674316e-07] yes=3,no=4,missing=3
            3:leaf=1.14607906
            4:[f35<-9.53674316e-07] yes=7,no=8,missing=7
                7:leaf=-6.87994671
                8:leaf=-0.10659159
        2:[f108<-9.53674316e-07] yes=5,no=6,missing=5
            5:[f38<-9.53674316e-07] yes=9,no=10,missing=9
                9:leaf=-0.0930657759
                10:leaf=-1.15261209
            6:leaf=1.00423074
    ```

### 1.3 Print its predicted probability

```txt
[0.50194526, 0.5244395, 0.5244395, 0.5244395, ...]
```

### 1.4 How to convert leaf value to probability?
   
in `PredTransform` function, it defines transformation like logitic and so on.

```cpp
// xgboost source code
void Predict(std::shared_ptr<DMatrix> data, bool output_margin,
            HostDeviceVector<bst_float> *out_preds, unsigned layer_begin,
            unsigned layer_end, bool training,
            bool pred_leaf, bool pred_contribs, bool approx_contribs,
            bool pred_interactions) override {
    int multiple_predictions = static_cast<int>(pred_leaf) +
                                static_cast<int>(pred_interactions) +
                                static_cast<int>(pred_contribs);
    this->Configure();
    CHECK_LE(multiple_predictions, 1) << "Perform one kind of prediction at a time.";
    if (pred_contribs) {
        gbm_->PredictContribution(data.get(), out_preds, layer_begin, layer_end, approx_contribs);
    } else if (pred_interactions) {
        gbm_->PredictInteractionContributions(data.get(), out_preds, layer_begin, layer_end,
                                            approx_contribs);
    } else if (pred_leaf) {
        gbm_->PredictLeaf(data.get(), out_preds, layer_begin, layer_end);
    } else {
        auto local_cache = this->GetPredictionCache();
        auto& prediction = local_cache->Cache(data, generic_parameters_.gpu_id);
        this->PredictRaw(data.get(), &prediction, training, layer_begin, layer_end);
        // Copy the prediction cache to output prediction. out_preds comes from C API
        out_preds->SetDevice(generic_parameters_.gpu_id);
        out_preds->Resize(prediction.predictions.Size());
        out_preds->Copy(prediction.predictions);
        if (!output_margin) {
        obj_->PredTransform(out_preds);
        }
    }
}
```

so, you just need transform leaf value using $1/(1+e^{-x})$ 



## 2. Realization

### 2.1 code structure

<!-- ![](/img/20221116171547.png)   -->

<div  class="f0">
<img src="/img/20221116171547.png" width = "300" alt="图片名称" align=right style="margin-right:50px"/>
</div >


- common 
  - common.h/.cpp
    - test loop number
    - lookup table
  - pred_transform
    - sigmoid
    - ... 
- frontend
  - xgboost (**load xgboot json model**)
  - sklearn
  - ... 
- include 
  - frontend interface
  - group tree declaration
  - ...
- main.cpp

<div style="float:None; clear: both;" align="left">
</div >

### 2.2 load model to memory

extract tree info

```cpp
ParsedModelInfo treeInfo;
{
    const std::string& sklearn_info = d["learner"].GetObject()["attributes"].GetObject()["scikit_learn"].GetString();
    // parse info
    rapidjson::Document di;
    di.Parse<rapidjson::kParseNanAndInfFlag>(sklearn_info.c_str(), sklearn_info.length());
    treeInfo.tree_num = di["n_estimators"].GetInt();
    treeInfo.tree_depth = di["max_depth"].GetInt();
}
```

According to feature value and index, we push regression tree to GBT model.

```cpp
{
    const rapidjson::Value& model = d["learner"].GetObject()["gradient_booster"].GetObject()["model"];
    const rapidjson::Value& trees = model.GetObject()["trees"].GetArray();
    
    for (int i = 0; i < treeInfo.tree_num; ++ i) {
        const rapidjson::Value& weight = trees[i].GetObject()["split_conditions"];
        const rapidjson::Value& index = trees[i].GetObject()["split_indices"];
        
        assert(weight.IsArray());
        assert(index.IsArray());
        std::vector<float> _weight;
        std::vector<int> _index;
        for (rapidjson::SizeType i = 0; i < weight.Size(); i++) {
            printf("weight[%d] = %f \n", i, weight[i].GetFloat());
            _weight.push_back(weight[i].GetFloat());
            printf("indices[%d] = %d \n", i, index[i].GetInt());
            _index.push_back(index[i].GetInt());
        }
        gbt.pushTree(_weight, _index);
    }
}
```



### 2.3 convert to group tree

```cpp
RegTree(int depthN, 
        const std::vector<float>& weight, 
        const std::vector<int>& index) {

    _depthG = _depthN / 4;
    int gNum = ((1 << (4 * _depthG)) - 1) / (16 - 1);
    _groups.resize(gNum);

    for (int i = 0; i < _depthG; ++i) {
        // previous group number
        int gNumPre = i == 0 ? 0 : ((1 << (4 * i)) - 1) / (16 - 1);
        // current group number
        int gNumCur = 1 << (4 * i);
        // node offset of current group row
        int nNumPre = 15 * gNumPre;
        // traverse current group by row
        for (int r = 0; r < gInnerDep; ++ r) {
            for (int j = 0; j < gNumCur; ++ j) {
                // current group index 
                int gIdxCur = gNumPre + j;
                // previous node in a group
                int rPre = r == 0 ? 0 : (1 << r) - 1;
                // jPre represents the start idx of node in this line of group
                int jPre = rPre * gNumCur + j * (1 << r);
                // traverse current group's row
                for (int n = 0; n < (1 << r); ++ n) {
                    int nIdx = nNumPre + jPre + n;
                    _groups[gIdxCur].setNodeData(rPre + n, \
                        weight[nIdx], index[nIdx]);
                }
            }
        }
        
        // init group children
        for (int j = 0; j < gNumCur; ++ j) {
            int gIdxCur = gNumPre + j;
            if (i != _depthG - 1) {
                _groups[gIdxCur].initGroupChildren(i, j);
            }
        }
    }
}
```


### 2.4 programmatic generation of lookup table

I wrote a program to automatically generate lookup table.

```cpp
#include <iostream>
#include <cstdio>

int bit[8] = {
    0b00000001,
    0b00000010,
    0b00000100,
    0b00001000,
    0b00010000,
    0b00100000,
    0b01000000,
    0b10000000
};



int main() {
    
    int lookup[256] = {0, };
    
    std::cout << "lookup[256] = {";

    for (int i = 0; i < 256; ++ i) {
        
        if ((i & bit[1]) == 0 && (i & bit[2]) == 0 && (i & bit[4]) == 0) {
            lookup[i] = 0;
        }

        if ((i & bit[1]) == 0 && (i & bit[2]) == 0 && (i & bit[4]) == bit[4]) {
            lookup[i] = 1;
        }

        if ((i & bit[1]) == 0 && (i & bit[2]) == bit[2] && (i & bit[5]) == 0) {
            lookup[i] = 2;
        }

        if ((i & bit[1]) == 0 && (i & bit[2]) == bit[2] && (i & bit[5]) == bit[5]) {
            lookup[i] = 3;
        }

        if ((i & bit[1]) == bit[1] && (i & bit[3]) == 0 && (i & bit[6]) == 0) {
            lookup[i] = 4;
        }

        if ((i & bit[1]) == bit[1] && (i & bit[3]) == 0 && (i & bit[6]) == bit[6]) {
            lookup[i] = 5;
        }

        if ((i & bit[1]) == bit[1] && (i & bit[3]) == bit[3] && (i & bit[7]) == 0) {
            lookup[i] = 6;
        }

        if ((i & bit[1]) == bit[1] && (i & bit[3]) == bit[3] && (i & bit[7]) == bit[7]) {
            lookup[i] = 7;
        }

        std::cout << lookup[i] << ", ";
    }
    
    std::cout << "}";
    return 0;
}
```

lookup table result:

```cpp
// in common.cpp
const uint8_t Common::lookup[256] = 
    {0, 0, 4, 4, 2, 2, 4, 4, 0, 0, 6, 6, 2, 2, 6, 6, 
     1, 1, 4, 4, 2, 2, 4, 4, 1, 1, 6, 6, 2, 2, 6, 6, 
     0, 0, 4, 4, 3, 3, 4, 4, 0, 0, 6, 6, 3, 3, 6, 6, 
     1, 1, 4, 4, 3, 3, 4, 4, 1, 1, 6, 6, 3, 3, 6, 6, 
     0, 0, 5, 5, 2, 2, 5, 5, 0, 0, 6, 6, 2, 2, 6, 6, 
     1, 1, 5, 5, 2, 2, 5, 5, 1, 1, 6, 6, 2, 2, 6, 6, 
     0, 0, 5, 5, 3, 3, 5, 5, 0, 0, 6, 6, 3, 3, 6, 6, 
     1, 1, 5, 5, 3, 3, 5, 5, 1, 1, 6, 6, 3, 3, 6, 6, 
     0, 0, 4, 4, 2, 2, 4, 4, 0, 0, 7, 7, 2, 2, 7, 7, 
     1, 1, 4, 4, 2, 2, 4, 4, 1, 1, 7, 7, 2, 2, 7, 7, 
     0, 0, 4, 4, 3, 3, 4, 4, 0, 0, 7, 7, 3, 3, 7, 7, 
     1, 1, 4, 4, 3, 3, 4, 4, 1, 1, 7, 7, 3, 3, 7, 7, 
     0, 0, 5, 5, 2, 2, 5, 5, 0, 0, 7, 7, 2, 2, 7, 7, 
     1, 1, 5, 5, 2, 2, 5, 5, 1, 1, 7, 7, 2, 2, 7, 7, 
     0, 0, 5, 5, 3, 3, 5, 5, 0, 0, 7, 7, 3, 3, 7, 7, 
     1, 1, 5, 5, 3, 3, 5, 5, 1, 1, 7, 7, 3, 3, 7, 7};
```


### 2.5 dataloader

use cnpy to load data

```cpp
cnpy::NpyArray arrX = cnpy::npy_load(dataPathX);
cnpy::NpyArray arrY = cnpy::npy_load(dataPathY);
float* loaded_dataX = arrX.data<float>();
float* loaded_dataY = arrY.data<float>();

int featDim = arrX.shape[1];
std::vector<float> smpX(featDim), smpY(featDim);
for (int i = 0; i < featDim; ++ i) {
    smpX[i] = loaded_dataX[i];
    smpY[i] = loaded_dataY[i];
} 
```


## 3. Test

<div  class="f0">

<img src="/img/20221117140643.png" width = "250" alt="图片名称" align=left style="margin-right:50px"/>

<img src="/img/20221117140600.png" width = "250" alt="图片名称" align=right style="margin-right:50px"/>
</div >

<div style="float:None; clear: both;">
</div >

if sample value > feature value, we assigned 1.
compare result: 41206 $\rightarrow$ 1010,0000,1111,0110

<div  class="f0">

<img src="/img/20221117141816.png" width = "200" alt="图片名称" align=right style="margin-right:100px"/>
</div >

<br>

mask result (little end):

<div style="float:None; clear: both;">
</div >

Visualize this tree. According to the previous binary code, we can find that right leaf value is ** and our program is also right.

![](/img/20221117173210.png)  


### Result

the final result (prediction probability), compared group tree (c++) and xgboost (python).

<div  class="f0">

<img src="/img/20221118094842.png" width = "300" alt="图片名称" align=left style="margin-right:50px"/>

<img src="/img/20221118094953.png" width = "300" alt="图片名称" align=right style="margin-right:50px"/>
</div >


<!-- ## Reference


https://gabrieltseng.github.io/posts/2018-02-25-XGB/

https://bailingnan.github.io/post/shen-ru-li-jie-xgboost/
 -->
