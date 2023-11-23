---
title: "Building RAG-based LLM Applications for Production (1)"
layout: post
author: "Zhang Jian"
header-style: text
tags:
  - llm
  - rag
---

**Note:** Check out newly added sections in this guide on [**fine-tuning**](https://www.anyscale.com/blog/a-comprehensive-guide-for-building-rag-based-llm-applications-part-1#fine-tuning), [**prompt engineering**](https://www.anyscale.com/blog/a-comprehensive-guide-for-building-rag-based-llm-applications-part-1#prompt-engineering)**,** [**lexical search**](https://www.anyscale.com/blog/a-comprehensive-guide-for-building-rag-based-llm-applications-part-1#lexical-search), [**reranking**](https://www.anyscale.com/blog/a-comprehensive-guide-for-building-rag-based-llm-applications-part-1#reranking) **and** [**data flywheel**](https://www.anyscale.com/blog/a-comprehensive-guide-for-building-rag-based-llm-applications-part-1#data-flywheel) — all with evaluation reports!

在本指南中，我们将学习如何：

*   💻 从头开始开发基于检索增强生成（RAG）的LLM应用程序。
*   🚀 在具有不同计算资源的多个工作节点上扩展主要工作负载（加载、切块、嵌入、索引、托管等）。
*   ✅ 评估我们应用程序的不同配置，以优化每个组件（例如`retrieval_score`）和整体性能（`quality_score`）。
*   🔀 实现OSS和封闭LLM之间的混合代理路由方法，创建性能最佳且具有成本效益的应用程序。
*   📦 以高度可扩展和可用的方式托管应用程序。
*   💡 了解微调、提示工程、词汇搜索、重新排序、数据飞轮等方法如何影响我们应用程序的性能。

## Overview

Large language models (LLMs) have undoubtedly changed the way we interact with information. However, they come with their fair share of limitations as to what we can ask of them. Base LLMs (ex. `Llama-2-70b`, `gpt-4`, etc.) are only aware of the information that they've been trained on and will fall short when we require them to know information beyond that. Retrieval augmented generation (RAG) based LLM applications address this exact issue and extend the utility of LLMs to our specific data sources. 

![image1](https://images.ctfassets.net/xjan103pcp94/3TBU5BOctjuaPyxuA8PGul/1c1b0b0129be5fef9eaef73063491582/image1.png "image1")

In this guide, we're going to build a RAG-based LLM application where we will incorporate external data sources to augment our LLM’s capabilities. Specifically, we will be building an assistant that can answer questions about [Ray](https://github.com/ray-project/ray) — a Python framework for productionizing and scaling ML workloads. The goal here is to make it easier for developers to adopt Ray, but also, as we'll see in this guide, to help improve our Ray documentation itself and provide a foundation for other LLM applications. We’ll also share challenges we faced along the way and how we overcame them.

**Note**: We have generalized this entire guide so that it can easily be extended to build RAG-based LLM applications on top of your own data.

![image2](https://images.ctfassets.net/xjan103pcp94/4PX0l1ruKqfH17YvUiMFPw/c60a7a665125cb8056bebcc146c23b76/image8.png "image2")

1.  `Pass the query to the embedding model to semantically represent it as an embedded query vector.`
    
2.  `Pass the embedded query vector to our vector DB.`
    
3.  `Retrieve the top-k relevant contexts – measured by distance between the query embedding and all the embedded chunks in our knowledge base.`
    
4.  `Pass the query text and retrieved context text to our LLM.`
    
5.  `The LLM will generate a response using the provided content.`
    

Besides just building our LLM application, we’re also going to be focused on scaling and serving it in production. Unlike traditional machine learning, or even supervised deep learning, scale is a bottleneck for LLM applications from the very beginning. Large datasets, models, compute intensive workloads, serving requirements, etc. We’ll develop our application to be able to handle any scale as the world around us continues to grow.

We’re also going to be focused on evaluation and performance. Our application involves many moving pieces: embedding models, chunking logic, the LLM itself, etc. and so it's important that we experiment with different configurations to optimize for the best quality responses. However, it's non-trivial to evaluate and quantitatively compare different configurations for a generative task. We’re going to break down evaluation of individual parts of our application (retrieval given query, generation given source), also assess the overall performance (end-to-end generation) and share findings towards an optimized configuration.

**Note**: We'll be experimenting with different LLMs (OpenAI, Llama, etc.) in this guide. You will need [OpenAI credentials](https://platform.openai.com/account/api-keys) to access [ChatGPT models](https://platform.openai.com/docs/models/) and [Anyscale Endpoints](https://endpoints.anyscale.com/) (public and private endpoints available) to serve + fine-tune OSS LLMs.

## Data

Before we can start building our RAG application, we need to first create our vector DB that will contain our processed data sources.

![image3](https://images.ctfassets.net/xjan103pcp94/3q5HUANQ4kS0V23cgEP0JF/ef3b62c5bc5c5c11b734fd3b73f6ea28/image3.png "image3")

### Load data

We’re going to start by loading the [Ray documentation](https://docs.ray.io/en/master/) from the website to a local directory:

```bash
export EFS_DIR=/desired/output/directory
wget -e robots=off --recursive --no-clobber --page-requisites \
  --html-extension --convert-links --restrict-file-names=windows \
  --domains docs.ray.io --no-parent --accept=html \
  -P $EFS_DIR https://docs.ray.io/en/master/
```

We’re going to then load our docs contents into a [Ray Dataset](https://docs.ray.io/en/latest/data/data.html) so that we can perform operations at scale on them (ex. embed, index, etc.). With large data sources, models and application serving needs, scale is a day-1 priority for LLM applications. We want to build our applications in such a way that they can scale as our needs grow _without_ us having to change our code later.

```py
# Ray dataset
DOCS_DIR = Path(EFS_DIR, "docs.ray.io/en/master/")
ds = ray.data.from_items([{"path": path} for path in DOCS_DIR.rglob("*.html") 
if not path.is_dir()])
print(f"{ds.count()} documents")
```

### Sections

Now that we have a dataset of all the paths to the html files, we're going to develop some functions that can appropriately extract the content from these files. We want to do this in a generalized manner so that we can perform this extraction across all of our docs pages (and so you can use it for your own data sources). Our process is to first identify the sections in our html page and then extract the text in between them. We save all of this into a list of dictionaries that map the text within a section to a specific url with a section anchor id.

![image5](https://images.ctfassets.net/xjan103pcp94/1eFnKmG5xqPIFtPupZ327X/f6152723e18322b90aaa8be5d2d5a6e4/image5.png "image5")

```py
sample_html_fp = Path(EFS_DIR, "docs.ray.io/en/master/rllib/rllib-env.html")
extract_sections({"path": sample_html_fp})[0]
```

`{'source': '`[`https://docs.ray.io/en/master/rllib/rllib-env.html#environments`](https://docs.ray.io/en/master/rllib/rllib-env.html#environments)`', 'text': '\nEnvironments#\nRLlib works with several different types of environments, including Farama-Foundation Gymnasium, user-defined, multi-agent, and also batched environments.\nTip\nNot all environments work with all algorithms. Check out the algorithm overview for more information.\n'}`

We can apply this extraction process (extract\_section) in parallel to all the file paths in our dataset with just one line using Ray Data’s [flat\_map](https://docs.ray.io/en/latest/data/api/doc/ray.data.Dataset.flat_map.html).

```py
# Extract sections
sections_ds = ds.flat_map(extract_sections)
sections = sections_ds.take_all()
print (len(sections))
```

### Chunk data

We now have a list of sections (with text and source of each section) but we shouldn't directly use this as context to our RAG application just yet. The text lengths of each section are all varied and many are quite large chunks. 

![image7](https://images.ctfassets.net/xjan103pcp94/6cLXmFm90OnDxXme5JzkLQ/03af428f0d78959a72ae162230745260/image7.png "image7")

If we were to use these large sections, then we'd be inserting a lot of noisy/unwanted context and because all LLMs have a maximum context length, we wouldn't be able to fit too much other relevant context. So instead, we're going to split the text within each section into smaller chunks. Intuitively, smaller chunks will encapsulate single/few concepts and will be less noisy compared to larger chunks. We're going to choose some typical text splitting values (`ex. chunk_size=300`) to create our chunks for now but we'll be experimenting with a wider range of values later.

```py
from langchain.document_loaders import ReadTheDocsLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter

# Text splitter
chunk_size = 300
chunk_overlap = 50
text_splitter = RecursiveCharacterTextSplitter(
    separators=["\n\n", "\n", " ", ""],
    chunk_size=chunk_size,
    chunk_overlap=chunk_overlap,
    length_function=len,
)

# Chunk a sample section
sample_section = sections_ds.take(1)[0]
chunks = text_splitter.create_documents(
    texts=[sample_section["text"]], 
    metadatas=[{"source": sample_section["source"]}])
print (chunks[0])
```

`page_content='ray.tune.TuneConfig.search_alg#\nTuneConfig.search_alg: Optional[Union[ray.tune.search.searcher.Searcher, ray.tune.search.search_algorithm.SearchAlgorithm]] = None#' metadata={'source': '`[`https://docs.ray.io/en/master/tune/api/doc/ray.tune.TuneConfig.search_alg.html#ray-tune-tuneconfig-search-alg`](https://docs.ray.io/en/master/tune/api/doc/ray.tune.TuneConfig.search_alg.html#ray-tune-tuneconfig-search-alg)`'}`

While chunking our dataset is relatively fast, let’s wrap the chunking logic into a function so that we can apply the workload at scale so that chunking remains just as fast as our data sources grow:

```py
def chunk_section(section, chunk_size, chunk_overlap):
    text_splitter = RecursiveCharacterTextSplitter(
        separators=["\n\n", "\n", " ", ""],
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len)
    chunks = text_splitter.create_documents(
        texts=[sample_section["text"]], 
        metadatas=[{"source": sample_section["source"]}])
    return [{"text": chunk.page_content, "source": chunk.metadata["source"]} for chunk in chunks]

# Scale chunking
chunks_ds = sections_ds.flat_map(partial(
    chunk_section, 
    chunk_size=chunk_size, 
    chunk_overlap=chunk_overlap))
print(f"{chunks_ds.count()} chunks")
chunks_ds.show(1)
```

`5727 chunks   {'text': 'ray.tune.TuneConfig.search_alg#\nTuneConfig.search_alg: Optional[Union[ray.tune.search.searcher.Searcher, ray.tune.search.search_algorithm.SearchAlgorithm]] = None#', 'source': '`[`https://docs.ray.io/en/master/tune/api/doc/ray.tune.TuneConfig.search_alg.html#ray-tune-tuneconfig-search-alg`](https://docs.ray.io/en/master/tune/api/doc/ray.tune.TuneConfig.search_alg.html#ray-tune-tuneconfig-search-alg)`'}`


### Embed data

Now that we've created small chunks from our sections, we need a way to identify the most relevant ones for a given query. A very effective and quick method is to embed our data using a pretrained model and use the same model to embed the query. We can then compute the distance between all of the chunk embeddings and our query embedding to determine the top-k chunks. There are many different pretrained models to choose from to embed our data but the most popular ones can be discovered through [HuggingFace's Massive Text Embedding Benchmark (MTEB)](https://huggingface.co/spaces/mteb/leaderboard) leaderboard. These models were pretrained on very large text corpus through tasks such as next/masked token prediction which allowed them to learn to represent sub-tokens in N dimensions and capture semantic relationships. We can leverage this to represent our data and identify the most relevant contexts to use to answer a given query. We're using Langchain's Embedding wrappers ([HuggingFaceEmbeddings](https://api.python.langchain.com/en/latest/embeddings/langchain.embeddings.huggingface.HuggingFaceEmbeddings.html) and [OpenAIEmbeddings](https://api.python.langchain.com/en/latest/embeddings/langchain.embeddings.openai.OpenAIEmbeddings.html)) to easily load the models and embed our document chunks.

**Note**: embeddings aren't the only way to determine the more relevant chunks. We could also use an LLM to decide! However, because LLMs are much larger than these embedding models and have maximum context lengths, it's better to use embeddings to retrieve the top k chunks. And then we could use LLMs on the fewer k chunks to determine the <k chunks to use as the context to answer our query. We could also use reranking (ex. [Cohere Rerank](https://txt.cohere.com/rerank/)) to further identify the most relevant chunks to use. We could also combine embeddings with traditional information retrieval methods such as keyword matching, which could be useful for matching for unique tokens that may potentially be lost when embedding sub-tokens.

```py
from langchain.embeddings import OpenAIEmbeddings
from langchain.embeddings.huggingface import HuggingFaceEmbeddings
import numpy as np
from ray.data import ActorPoolStrategy

class EmbedChunks:
    def __init__(self, model_name):
        if model_name == "text-embedding-ada-002":
            self.embedding_model = OpenAIEmbeddings(
                model=model_name,
                openai_api_base=os.environ["OPENAI_API_BASE"],
                openai_api_key=os.environ["OPENAI_API_KEY"])
        else:
            self.embedding_model = HuggingFaceEmbeddings(
                model_name=model_name,
                model_kwargs={"device": "cuda"},
                encode_kwargs={"device": "cuda", "batch_size": 100})

    def __call__(self, batch):
        embeddings = self.embedding_model.embed_documents(batch["text"])
        return {"text": batch["text"], "source": batch["source"], "embeddings": 
embeddings}

```

Here we're able to embed our chunks at scale by using [`map_batches`](https://docs.ray.io/en/latest/data/api/doc/ray.data.Dataset.map_batches.html). All we had to do was define the `batch_size` and the compute (we're using two workers, each with 1 GPU).

```py
# Embed chunks
embedding_model_name = "thenlper/gte-base"
embedded_chunks = chunks_ds.map_batches(
    EmbedChunks,
    fn_constructor_kwargs={"model_name": embedding_model_name},
    batch_size=100, 
    num_gpus=1,
    compute=ActorPoolStrategy(size=2))
```

`# Sample (text, source, embedding) triplet   [{'text': 'External library integrations for Ray Tune#',     'source': '`[`https://docs.ray.io/en/master/tune/api/integration.html#external-library-integrations-for-ray-tune`](https://docs.ray.io/en/master/tune/api/integration.html#external-library-integrations-for-ray-tune)`',     'embeddings': [   0.012108353897929192,   0.009078810922801495,   0.030281754210591316,   -0.0029687234200537205,   …]   }`


### Index data

Now that we have our embedded chunks, we need to index (store) them somewhere so that we can retrieve them quickly for inference. While there are many popular vector database options, we're going to use [Postgres with pgvector](https://github.com/pgvector/pgvector) for its simplicity and performance. We'll create a table (document) and write the (text, source, embedding) triplets for each embedded chunk we have.

![image2](https://images.ctfassets.net/xjan103pcp94/3z1ryYkOtUjj6N1IuavJPf/ae60dc4a10c94e2cc928c38701befb51/image2.png "image2")

```py
class StoreResults:
    def __call__(self, batch):
        with psycopg.connect(os.environ["DB_CONNECTION_STRING"]) as conn:
            register_vector(conn)
            with conn.cursor() as cur:
                for text, source, embedding in zip
                (batch["text"], batch["source"], batch["embeddings"]):
                    cur.execute("INSERT INTO document (text, source, embedding) 
                    VALUES (%s, %s, %s)", (text, source, embedding,),)
        return {}
```

And once again, we can use Ray Data’s [map\_batches](https://docs.ray.io/en/latest/data/api/doc/ray.data.Dataset.map_batches.html) to perform this indexing in parallel:

```py
# Index data
embedded_chunks.map_batches(
    StoreResults,
    batch_size=128,
    num_cpus=1,
    compute=ActorPoolStrategy(size=28),
).count()
```

## Retrieval

With our embedded chunks indexed in our vector database, we're ready to perform retrieval for a given query. We'll start by using the same embedding model we used to embed our text chunks to now embed the incoming query.

![image14](https://images.ctfassets.net/xjan103pcp94/1hKBrFU2lyR5LLebFyq2ZL/8845c36ff98eb47005338de6ab6dbf50/image14.png "image14")

```py
# Embed query
embedding_model = HuggingFaceEmbeddings(model_name=embedding_model_name)
query = "What is the default batch size for map_batches?"

embedding = np.array(embedding_model.embed_query(query))
len(embedding)
```
`768`

Then, we'll retrieve the top-k most relevant chunks by extracting the closest embedded chunks to our embedded query. We use cosine distance (<=>) but there are [many options](https://github.com/pgvector/pgvector#vector-operators) to choose from. Once we retrieve the top num\_chunks, we can collect the text for each chunk and use it as context to generate a response.

```py
# Get context
num_chunks = 5
with psycopg.connect(os.environ["DB_CONNECTION_STRING"]) as conn:
    register_vector(conn)
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM document ORDER BY embedding <-> %s LIMIT %s", (embedding, num_chunks))
        rows = cur.fetchall()
        context = [{"text": row[1]} for row in rows]
        sources = [row[2] for row in rows]
```


[`https://docs.ray.io/en/master/data/api/doc/ray.data.Dataset.map_batches.html#ray-data-dataset-map-batches`](https://docs.ray.io/en/master/data/api/doc/ray.data.Dataset.map_batches.html#ray-data-dataset-map-batches)`entire blocks as batches (blocks may contain different numbers of rows).   The actual size of the batch provided to fn may be smaller than   batch_size if batch_size doesn’t evenly divide the block(s) sent   to a given map task. Default batch_size is 4096 with “default”.`

[`https://docs.ray.io/en/master/data/api/doc/ray.data.Dataset.map_batches.html#ray-data-dataset-map-batches`](https://docs.ray.io/en/master/data/api/doc/ray.data.Dataset.map_batches.html#ray-data-dataset-map-batches)`   entire blocks as batches (blocks may contain different numbers of rows).   The actual size of the batch provided to fn may be smaller than   batch_size if batch_size doesn’t evenly divide the block(s) sent   to a given map task. Default batch_size is 4096 with “default”.`

`(cont…)`

## Generation

We can now use the context to generate a response from our LLM. Without this relevant context that we retrieved, the LLM may not have been able to accurately answer our question. And as our data grows, we can just as easily embed and index any new data and be able to retrieve it to answer questions.

![image16](https://images.ctfassets.net/xjan103pcp94/38I8en8Tyf0cM4LUhjygoq/739d456c80841b4c28fe80f73ea5856b/image16.png "image16")

```py
from rag.generate import prepare_response
from rag.utils import get_credentials

def generate_response(
    llm, temperature=0.0, stream=True,
    system_content="", assistant_content="", user_content="", 
    max_retries=3, retry_interval=60):
    """Generate response from an LLM."""
    retry_count = 0
    api_base, api_key = get_credentials(llm=llm)
    while retry_count < max_retries:
        try:
            response = openai.ChatCompletion.create(
                model=llm,
                temperature=temperature,
                stream=stream,
                api_base=api_base,
                api_key=api_key,
                messages=[
                    {"role": "system", "content": system_content},
                    {"role": "assistant", "content": assistant_content},
                    {"role": "user", "content": user_content},
                ],
            )
            return prepare_response(response=response, stream=stream)

        except Exception as e:
            print(f"Exception: {e}")
            time.sleep(retry_interval)  # default is per-minute rate limits
            retry_count += 1
    return ""
```

**Note**: We’re using a temperature of 0.0 to enable reproducible experiments but you should adjust this based on your use case. For use cases that need to always be factually grounded, we recommend very low temperature values while more creative tasks can benefit from higher temperatures.


```py
# Generate response
query = "What is the default batch size for map_batches?"
response = generate_response(
    llm="meta-llama/Llama-2-70b-chat-hf",
    temperature=0.0,
    stream=True,
    system_content="Answer the query using the context provided. Be succinct.",
    user_content=f"query: {query}, context: {context}")
```

`The default batch size for map_batches is 4096.`

