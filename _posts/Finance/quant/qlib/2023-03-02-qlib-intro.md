---
title: "Qlib"
subtitle: "Data Layer: Data Framework & Usage"
layout: post
author: "Zhang Jian"
header-style: text
mathjax: true
tags:
  - finance
  - qlib
---

## 简介

qlib提供了高性能的数据基础架构，它专门为量化投资而设计。例如，用户可以轻松地使用数据层构建Formulaic Alphas：

对`Data Layer`的介绍包括以下几个部分：
1. Data Preparation
2. Data API
3. Data Loader
4. Data Handler
5. Dataset
6. Cache
7. Data and Cache File Structure


以下是Qlib数据工作流程的典型示例：

1. 用户下载数据并将其转换为Qlib格式（文件名后缀为.bin）。在此步骤中，通常只有一些基本数据存储在磁盘上，例如OHLCV数据。

2. 基于Qlib的表达式引擎（例如“Ref($close, 60) / $close”，最近60个交易日的收益率），创建一些基本特征。表达式引擎支持的运算符可以在[这里](https://github.com/microsoft/qlib/blob/main/qlib/data/ops.py)找到。这一步通常在Qlib的数据加载器中实现，它是数据处理程序的一个组件。

3. 如果用户需要更复杂的数据处理（例如数据归一化），数据处理程序支持用户自定义处理器来处理数据（可以在[这里](https://github.com/microsoft/qlib/blob/main/qlib/data/dataset/processor.py)找到一些预定义的处理器）。处理器与表达式引擎中的运算符不同。它是为一些复杂的数据处理方法设计的，这些方法很难在表达式引擎的运算符中支持。

4. 最后，数据集负责从数据处理程序处理后的数据准备模型特定的数据集。


## Data Preparation

### Qlib Format Data

我们专门设计了一个数据结构来管理金融数据，请参阅Qlib论文中的文件存储设计部分以获取详细信息。这些数据将以文件名后缀.bin的形式存储（我们将它们称为.bin文件、.bin格式或qlib格式）。.bin文件是为金融数据的科学计算而设计的。

此外，Qlib还提供了一个高频数据集。用户可以通过以下[链接](https://github.com/microsoft/qlib/tree/main/examples/highfreq)运行高频数据集示例。

### Qlib Format Dataset

Qlib已经提供了一个现成的.bin格式数据集，用户可以使用脚本scripts/get_data.py来下载China-Stock数据集，如下所示。用户也可以使用numpy加载.bin文件来验证数据。由于它们是调整后的价格，因此和实际成交价看起来可能有所不同。然后，您可能会发现，不同的数据源调整价格的方式可能不同。Qlib在调整价格时将每只股票的第一交易日的价格归一化为1。用户可以利用$factor获取原始交易价格（例如，$close / $factor可以获取原始收盘价）。

```bash
# download 1d
python scripts/get_data.py qlib_data --target_dir ~/.qlib/qlib_data/cn_data --region cn

# download 1min
python scripts/get_data.py qlib_data --target_dir ~/.qlib/qlib_data/qlib_cn_1min --region cn --interval 1min
```

除了China-Stock数据集之外，Qlib还包括一个US-Stock数据集，可以使用以下命令下载：

```bash
python scripts/get_data.py qlib_data --target_dir ~/.qlib/qlib_data/us_data --region us
```

运行上述命令后，用户可以在~/.qlib/qlib_data/cn_data目录和~/.qlib/qlib_data/us_data目录中找到以Qlib格式存储的China-Stock和US-Stock数据。

Qlib还提供了scripts/data_collector中的脚本，帮助用户爬取最新的互联网数据并将其转换为qlib格式。

当使用此数据集初始化Qlib时，用户可以使用它来构建和评估自己的模型。有关更多详细信息，请参见[初始化](https://qlib.readthedocs.io/en/latest/start/initialization.html)。


### Automatic update of daily frequency data

**建议用户手动更新数据一次（--trading_date 2021-05-25），然后将其设置为自动更新。**

有关更多信息，请参见：yahoo collector

- 每个交易日自动更新数据到“qlib”目录（Linux）
  - use crontab: crontab -e
  - set up timed tasks:
    
    ```bash
    python <script path> update_data_to_bin --qlib_data_1d_dir <user data dir>
    ```
  - script path: scripts/data_collector/yahoo/collector.py
  
- 手动数据更新

    -  trading_date: start of trading day
    -  end_date: end of trading day(not included)


            ```bash
            python scripts/data_collector/yahoo/collector.py update_data_to_bin --qlib_data_1d_dir <user data dir> --trading_date <start date> --end_date <end date>
            ```

  


### Converting CSV Format into Qlib Format


Qlib提供了脚本`scripts/dump_bin.py`，只要数据格式正确，就可以将任何CSV格式的数据转换为.bin文件（Qlib格式）。

除了下载准备好的演示数据之外，用户可以按照以下方式直接从Collector下载演示数据，以供CSV格式的参考。以下是一些示例：


for daily data:

```bash
python scripts/get_data.py csv_data_cn --target_dir ~/.qlib/csv_data/cn_data
```

for 1min data:

```bash
python scripts/data_collector/yahoo/collector.py download_data --source_dir ~/.qlib/stock_data/source/cn_1min --region CN --start 2021-05-20 --end 2021-05-23 --delay 0.1 --interval 1min --limit_nums 10
```

用户也可以提供自己的CSV格式数据。但是，CSV数据必须满足以下条件：

1. CSV文件以特定股票的名称命名，或者CSV文件包括一列股票名称。
   - 以股票名称命名CSV文件：SH600000.csv，AAPL.csv（不区分大小写）。
   - CSV文件包括一列股票名称。用户在转换数据时必须指定列名。以下是一个示例：

        ```bash
        python scripts/dump_bin.py dump_all ... --symbol_field_name symbol
        ```

2. CSV文件必须包括一个日期列，当转换数据时，用户必须指定日期列的名称。以下是一个例子：
   
    ```bash
    python scripts/dump_bin.py dump_all ... --date_field_name date
    ```


如果用户准备在目录 ~/.qlib/csv_data/my_data 中提供他们自己的 CSV 格式数据，可以运行以下命令开始转换：

```bash 
python scripts/dump_bin.py dump_csv -d ~/.qlib/csv_data/my_data --freq 1d --include_fields date,open,high,low,close,volume --date_field_name date --preprocess "" --postprocess "qlib.contrib.dataset.processor.CSVPandasTransform()" -o ~/.qlib/qlib_data/my_data
```


其中，参数含义如下：

- -d 指定了要转换的 CSV 文件所在的目录。
- --freq 指定数据频率，例如 1d 表示每日数据，1min 表示每分钟数据，具体的可选值请参考 Qlib 文档。
- --include_fields 指定 CSV 文件中包含哪些字段，具体的可选值请参考 Qlib 文档。
- --date_field_name 指定 CSV 文件中日期字段的名称。
- --preprocess 可以传入一些预处理函数，对原始数据进行处理，例如剔除缺失值等。这里传入的是一个空字符串，表示不进行任何预处理。
- --postprocess 指定了数据转换完成后的处理方式，这里采用的是 Qlib 内置的 CSVPandasTransform() 函数，将 Pandas DataFrame 格式的数据转换为 Qlib 数据格式。
- -o 指定了转换后的数据存放目录。

用户在将数据转换成.bin格式时，还可以使用其他支持的参数，可以通过运行以下命令获取相关信息：

```bash
python dump_bin.py dump_all --help
```

转换完成后，用户可以在目录~/.qlib/qlib_data/my_data中找到转换后的Qlib格式数据。


参数--include_fields的选项应与CSV文件的列名对应。 Qlib提供的数据集的列名应至少包括open，close，high，low，volume和factor。

- open: 复权开盘价
- close: 复权收盘价
- high: 复权最高价
- low: 复权最低价
- volume: 复权交易量
- factor: 复权因子。通常，factor = adjusted_price / original_price，其中adjusted price参考：[split adjusted](https://www.investopedia.com/terms/s/splitadjusted.asp)

在Qlib数据处理的约定中，如果股票停牌，则open，close，high，low，volume，money和factor将设置为NaN。如果您想使用自己的alpha-factor，这些因子不能由OCHLV计算，例如PE，EPS等，你可以将它们添加到包含OHCLV数据的CSV文件中，然后将其转储为Qlib格式数据。


<div>
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
    <h4 style="margin: 0;">OHCLV数据</h4    >
    <button onclick="toggleContent(this)" style="border: none; background-color: #fff; cursor: pointer; font-size: 16px; color: #555;">展开/收起</button>
  </div>
  <div class="knowledge-box-content" style="display: none;">
    <p>
    OHCLV数据是一种金融市场数据格式，包括以下五个方面的数据：

    开盘价 (Open): 每个时间周期开始时的第一个交易价格。
    最高价 (High): 每个时间周期内最高的交易价格。
    最低价 (Low): 每个时间周期内最低的交易价格。
    收盘价 (Close): 每个时间周期结束时的最后一个交易价格。
    成交量 (Volume): 每个时间周期内的总交易量。
    这些数据是在特定时间段内（如一天或一个小时）记录的，通常用于股票、期货和外汇市场的技术分析和预测模型中。 OHCLV数据被广泛应用于股票分析、期货交易和外汇市场的技术分析中，因为它们提供了市场行情的一个全面的图像。
    </p>
  </div>
</div>

<script>
function toggleContent(button) {
  var content = button.parentNode.nextElementSibling;
  if (content.style.display === "none") {
    content.style.display = "block";
  } else {
    content.style.display = "none";
  }
}
</script>

### Multiple Stock Modes

Qlib现在为用户提供了两种不同的股票模式：中国股票模式和美国股票模式。下面是这两种模式的一些不同设置：

|Region	|Trade Unit	|Limit Threshold |
|China	|100	|0.099|
|US	|1	|None|


初始化中国股票模式下的Qlib
假设用户将Qlib格式数据下载到目录~/.qlib/qlib_data/cn_data中。用户只需要按照以下方式初始化Qlib。
```bash
from qlib.constant import REG_CN
qlib.init(provider_uri='~/.qlib/qlib_data/cn_data', region=REG_CN)
```
如果用户在美国股票模式下使用Qlib，则需要美国股票数据。Qlib还提供了一个脚本来下载美国股票数据。用户可以按照以下步骤在美国股票模式下使用Qlib：
下载qlib格式的美国股票数据，请参见Qlib格式数据集部分。

初始化美国股票模式下的Qlib
假设用户在目录~/.qlib/qlib_data/us_data中准备了Qlib格式数据。用户只需要按照以下方式初始化Qlib。

```bash
from qlib.config import REG_US
qlib.init(provider_uri='~/.qlib/qlib_data/us_data', region=REG_US)
```

## Data API

### Data Retrieval (数据检索)

用户可以使用qlib.data中的API检索数据，请参考数据检索

### Feature


### Filter


### Reference


## Data Loader


### QlibDataLoader

### StaticDataLoader

### Interface

### API

## Data Handler

### DataHandlerLP

### Interface



### Processor


### Example


### API


## Dataset

## Cache

## Data and Cache File Structure









