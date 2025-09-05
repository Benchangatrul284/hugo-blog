---
date: '2025-09-05T17:15:59+08:00'
title: 'Introduction to Large Language Models'
draft: false
cover:
  image: 'img/IntroToLLM/cover.png'
  alt: 'cover'

params:
  math: true
tags: ['LLM']
categories: 'Notes'
description: 'Introduction To LLM'
summary: "Introduction To LLM"
---


# 目錄

- [Introduction](#introduction)
    - [Encoding](#encoding)
    - [Generation](#generation)
    - [Decoding](#decoding)
    - [Structure of LLM](#structure-of-llm)
    - [GPT Series](#gpt-series)
- [Transformer Block](#transformer-block)
    - [Self-Attention](#self-attention)
    - [Feed Forward Network (FFN)](#feed-forward-network-ffn)
    - [Residual Connection](#residual-connection)
    - [Layer Normalization](#layer-normalization)
    - [Summary](#summary-of-transformer-block)
- [Self-Attention](#self-attention-1)
    - [Attention Map](#attention-map)
    - [Computation of Attention Map](#computation-of-attention-map)
    - [Summary](#summary-of-self-attention)
- [Positional Embedding](#positional-embedding)
    - [GPT2 Positional Embedding](#gpt2-positional-embedding)
    - [RoPE](#rope)

# Introduction
語言模型和其他深度學習模型一樣，都是去學到一個 function，讓輸入經過這個 function 後可以得到我們想要的輸出。也就是給定 x ，我們會希望得到一個 mapping f(x) = y 。
![truncated](/img/IntroToLLM/img1.png)

語言模型主要可以分成兩大部分，分別是 **Causal Language Model (CLM)** 和 **Masked Language Model (MLM)** 。現在 GPT 模型大多是 CLM，也就是利用文字接龍的方法來產生文字。而 BERT 則是屬於 MLM ，也就是給定一段文字後，隨機把其中一些字遮住 (mask)，然後讓模型去預測這些被遮住的字是什麼。 這篇 blog post 主要著重在 CLM 模型。

在生成的過程當中，其實可以分成三個階段:  
```Tokenizer encoding -> Large language model generation -> Tokenizer decoding```
![truncated](/img/IntroToLLM/img4.png)

在詳細介紹這三個階段之前，請容許筆者岔個題，介紹一下 huggingface。HuggingFace 是一個非常好用的深度學習模型分享平台，裡面有非常多的預訓練模型 (pre-trained model)，可以讓我們直接拿來使用，而不需要自己從頭開始訓練模型。另外，HuggingFace 也提供了非常方便的 library ，例如 [transformers](https://github.com/huggingface/transformers) 。transformers 可以讓使用者可以快速上手 LLM ，這裡舉一個簡單的例子。
![truncated](/img/IntroToLLM/img8.png)
這裡就是利用 pipeline 這個 class 來使用 gpt2，只需要幾行 code 就可以用 gpt2 文字接龍，非常方便。

### Encoding
因為語言模型本身看不懂文字。Tokenizer 的主要功能是把文字轉換成數字 (token)，這樣模型才能夠處理。這些 tokenizer 通常會把文字切成比較小的單位，然後給每個單位一個對應的數字 (token id)。例如 ```"Hello, world!"``` 可能會被切成 ```["Hello", ",", "world", "!"]```，然後對應的 token id 可能是 ```[101, 102, 103, 104]``` (這只是舉例，實際的 token id 會根據不同的 tokenizer 而有所不同)。
![truncated](/img/IntroToLLM/img5.png)

### Generation
Large language model 的主要功能是根據輸入的 token id 來預測下一個 token id 的機率分佈。經過採樣後，就可以產生下一個 token id。如何採樣會在後面章節講解。
![truncated](/img/IntroToLLM/img6.png)

### Decoding
Tokenizer decoding 的主要功能是把模型輸出的 token id 轉換回文字。如果模型輸出的 token id 是 ```[105]```，那麼根據 tokenizer 的對應表，可能會被轉換回 ```"!"```。
![truncated](/img/IntroToLLM/img7.png)

### Structure of LLM
LLM 是由許多小 module 組合而成，主幹是 transformers blocks。embedding table 的功能是把 token id 轉換成一個向量，通常叫做 hidden_states。經過一堆的 transformers blocks 後，最後經過 lm_head 將 hidden_states 轉換成 logits，再經過 softmax 轉換成機率分佈。值得注意的是，logits 的 dimension 是 vocab_size (tokenizer 的字典大小)，也就是說每個 token 都會有一個對應的機率。
![truncated](/img/IntroToLLM/img9.png)

# GPT Series
OpenAI 應該是整波 LLM 爆紅的領頭羊，相信大家對 ChatGPT 應該不陌生。這裡用很簡單的一張圖 summarize 一下 LLM 發展的歷程。
![truncated](/img/IntroToLLM/img10.png)
### Train Time Scaling
對應上圖左側：在訓練時堆更多計算資源與資料。早期 GPT-1/2/3 幾乎就是這條路線——更大的模型參數、更多的時間訓練、更多資料與更多 GPU，當然還有更燒錢。這是根據 scaling laws 的經驗法則：模型越大、資料越多，表現越好。

### Instruction Following
上圖中由 train-time scaling 走向「指令跟隨」。方法通常是先有一個強的 foundation model，再做：
- SFT：以大量「指令 → 回答」資料做監督式微調，讓模型能理解並執行指令；
- RLHF / DPO：用人類偏好或 AI 偏好對齊，使輸出更有幫助、更安全，或更加的政治正確。
GPT-3.5 可視為此階段的代表，從會文字接龍進化到能理解指令。

### Multimodality
輸入/輸出不再只限文字，而是加入圖片、音訊、影片等。像 GPT‑4/4o 這類模型即屬此範疇。往後的 frontier model 大多有這些能力。

### Test Time Scaling
因為訓練資料缺乏，Test Time Scaling 轉而在 inference 階段投入更多計算，以換取更好的答案，而非只靠更大模型。技巧包含：
OpenAI o series 可視為強化「推理過程」與「驗證」的代表路線。

### AI Agent
讓模型「能感知、能規劃、會行動」。像是 MCP 就是為了 AI Agent 而生的 protocol。


# Transformer Block
Transformer Block 是語言模型的骨幹。每個 block 由 Self‑Attention、Feed Forward Network、Residual Connection 與 Layer Normalization 組成。LLM 基本上就是把很多個 Transformer Blocks 疊起來。

### Self-Attention
自注意力讓 sequence 中的每一個 token 都能「與其他所有 token 對話」。Self-Attention 的輸入與輸出維度相同，這樣就可以方便與其他模組堆疊。不用和 CNN 一樣還要算 feature map 的 dimension。
![truncated](/img/IntroToLLM/img11.png)

### Feed Forward Network (FFN)
FFN 作用在「每個 token 各自的向量」上，彼此不互相溝通；常見結構是兩層的 ```nn.Linear``` 和 nonlinear function（如 GELU/SiLU），中間維度先擴張成 ```intermediate size``` 再壓回 ```hidden size```，因此整體「輸入維度 = 輸出維度」。在多數 LLM 中，FFN 佔據了相當大比例的參數量與計算量，可以看做是模型儲存知識的地方。
![truncated](/img/IntroToLLM/img12.png)

### Residual Connection
Residual Connection提供一條乾淨直接的 gradient path，讓更深的模型也能穩定收斂。實作上就是把子模組的輸出與原輸入相加（add），常見寫法為 `x = x + sublayer(x)`。
![truncated](/img/IntroToLLM/img13.png)

### Layer Normalization
LayerNorm 會沿著輸入的 hidden 維度做正規化，穩定特徵尺度並加速訓練。為什麼用 LayerNorm？因為在 LLM 當中，sequence length 會變、同一 batch 內的 token 數也不固定，BatchNorm 的統計在此情境下不穩定；相對地，因為hidden size 固定，因此 LayerNorm 更合適。
![truncated](/img/IntroToLLM/img14.png)

### Summary of Transformer Block
綜合以上：每個 Block 大致遵循「LayerNorm → Self‑Attention → Residual Connection」以及「LayerNorm → FFN → Residual Connection」的結構，反覆堆疊後就形成了整個語言模型的主幹。
![truncated](/img/IntroToLLM/img15.png)


# Self-Attention
Self-Attention 是 Transformer Block 的核心。它讓 sequence 中的每個 token 都能「與其他所有 token 對話」，解決了 RNN 缺少長期記憶的痛點。另外，Self-Attention 在訓練的時候可以 parallelize，速度更快。但這一切是有代價的，因為要一字不漏記住前面所有的 context ，也造就了 LLM 在 inference 時，為了記住前面 token 的資訊，會導致 memory consumption 越來越大，也就是惡名昭彰的 KV cache 問題。
話有些扯遠了，回到 Self-Attention 本身。
「Self」代表同一個 sequence ；「Attention」代表找出 token 之間的關係。合在一起，Self‑Attention 的目的就是估計同一 sequence 中各個 token 彼此的關聯。本節的重點是下面式子的意義與直覺。
![truncated](/img/IntroToLLM/img16.png)

### Attention Map
Attention Map 用來描述 token 與 token 的兩兩的關聯。對長度為 n 的輸入 sequence ，Attention Map 是一個 `n × n` 矩陣；舉個例子，如果只有三個 token，便是 `3 × 3` 的 attention map。矩陣中的每個元素稱為 attention score，代表「第 i 個 token 對第 j 個 token 的注意力大小」。注意這個分數通常不對稱，也就是說 `score(i, j) ≠ score(j, i)`。像是矮哥布林猴哪能引起[藥律工💊🟢🏹](https://www.threads.com/@zelpha_chang)的注意力呢，畢竟藥律工💊🟢🏹是人之所向阿。

經過 per row 的 Softmax 後，每一列都會形成總和為 1 的機率分佈；在看到整段 input sequence 時，整張 Attention Map 可以一次計算出來，不會向 RNN 一樣只能一步步往前算造成效率低落。
![truncated](/img/IntroToLLM/img17.png)

### Computation of Attention Map
計算方式：先把輸入的 hidden states 經過 WQ、WK、WV project 成 Query(Q)、Key(K)、Value(V)。attention score 由 `Q` 與 `K` 的 dot product 得到，之後沿著 row 方向套用 `Softmax`，使每一列的 attention score 總和為 1。
![truncated](/img/IntroToLLM/img18.png)

為什麼要除以根號 d_k？d_k 是 head dimension ，可以理解成一個 head 內的 hidden dimension。計算 `QK^T` 後，attention score 的 variance 會隨 hidden dimension `d_k` 增大，容易讓 `Softmax` 飽和。為了把 variance 穩定在接近 1，我們以 `√d_k` 進行 scaling，也就是採用 `QK^T / √d_k`。
![truncated](/img/IntroToLLM/img19.png)

Combining Values：最後使用 attention score 作為 weighted sum 的權重，對 Value(V) 做加權平均，得到每個 token 新的 hidden states。直覺上是先決定該關注哪些位置 (attention map)、各看多少(value)，再把被關注位置的資訊彙整回來。(weighted sum)
![truncated](/img/IntroToLLM/img20.png)

最後可以用這張圖來表示前面的數學式子。這裡假設 sequence length 為 2。
![truncated](/img/IntroToLLM/img21.png)

### Summary of Self-Attention
最後的最後，前面看不懂都沒有關係，只要記住一點，輸出維度等於輸入維度，我們可以把它 self-attention 看成一個黑盒子，輸入一個 sequence，輸出一個同樣長度的 sequence，然後每個 token 都能跟其他 token 溝通就好。
![truncated](/img/IntroToLLM/img22.png)


# Positional Embedding
為什麼需要 positional embedding？因為 self-attention 本身不帶有任何位置資訊。Positional embedding 可以 hand craft，也可以從資料中學習。這裡將介紹 learned positional embedding（GPT2）與 rotary positional embedding（RoPE）。

### GPT2 Positional Embedding
以 GPT2 為例， sequence 中每一個位置都對應一個 768 維的向量作為 positional embedding。GPT2 預設提供 1024 個位置，屬於 absolute 的編碼方式，而且這些權重是從資料中學習而來。
![truncated](/img/IntroToLLM/img23.png)

進一步觀察 GPT2 的 positional embedding，我們可以拆解到單一 channel 來看；會發現這些向量大致可視為不同頻率的 sine 與 cosine 函數的疊加。

![truncated](/img/IntroToLLM/img24.png)


不過，GPT2 的 positional embedding 也有幾個缺點：他的表現相當規律，存在一定程度的 redundancy；此外，因為預先定義固定長度，context length 會受到 embedding table 大小的限制。

### RoPE
RoPE 源自 [RoFormer](https://arxiv.org/abs/2104.09864)，具備良好的 extensibility，不需要事先定義最大的 sequence 長度。它透過 rotation matrix 將相對位置信息編入 queries 與 keys（不作用於 values!）。

先回顧 2D 的 rotation matrix。假設 hidden dimension 為 2，且我們正在計算位置 m 的 positional encoding：

\[
\begin{pmatrix}
\cos(m\theta_{0}) & -\sin(m\theta_{0}) \\
-\sin(m\theta_{0}) & \cos(m\theta_{0})
\end{pmatrix}
\]

擴展到更高維度(d)：

\[
\begin{pmatrix}
\cos(m\theta_{1}) & -\sin(m\theta_{1}) & 0 & 0 & \cdots & 0 & 0 \\
\sin(m\theta_{1}) &  \cos(m\theta_{1}) & 0 & 0 & \cdots & 0 & 0 \\
0 & 0 & \cos(m\theta_{2}) & -\sin(m\theta_{2}) & \cdots & 0 & 0 \\
0 & 0 & \sin(m\theta_{2}) &  \cos(m\theta_{2}) & \cdots & 0 & 0 \\
\vdots & \vdots & \vdots & \vdots & \ddots & \vdots & \vdots \\
0 & 0 & 0 & 0 & \cdots & \cos(m\theta_{d/2}) & -\sin(m\theta_{d/2}) \\
0 & 0 & 0 & 0 & \cdots & \sin(m\theta_{d/2}) &  \cos(m\theta_{d/2})
\end{pmatrix}
\]

$$
\theta_i=\mathrm{base}^{-\frac{2i}{d}}
$$

得到 rotation matrix 後，將它作用在 queries 與 keys 上：
![truncated](/img/IntroToLLM/img25.png)


由於 rotation matrix 結構相對稀疏 (很多 0)，實作時常以 hadamard product 的形式與 pre-defined 的向量進行計算。某種意義上，RoPE 可以視為在 queries（或 keys）與一組 pre-defined 向量之間做 hadamard product。(note: hadamard product 代表 element-wise multiplication)
![truncated](/img/IntroToLLM/img26.png)
