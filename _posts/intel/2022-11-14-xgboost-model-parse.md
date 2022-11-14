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

## Reference


https://gabrieltseng.github.io/posts/2018-02-25-XGB/

https://bailingnan.github.io/post/shen-ru-li-jie-xgboost/

