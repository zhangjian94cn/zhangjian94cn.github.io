---
title: "XGBoost Model Parser"
layout: post
author: "Zhang Jian"
header-style: text
mathjax: true
tags:
  - note
  - xgboost
---

## Introduction

**Use simple tree as an example**

1. Its model json

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

2. Visualize it
    
    ![](/img/20221114164252.png) 

3. Print its predicted probability

    ```txt
    [0.50194526, 0.5244395, 0.5244395, 0.5244395, ...]
    ```

4. How to convert leaf value to probability?
   
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


## code structure

```bash
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


## Reference


https://gabrieltseng.github.io/posts/2018-02-25-XGB/

https://bailingnan.github.io/post/shen-ru-li-jie-xgboost/

