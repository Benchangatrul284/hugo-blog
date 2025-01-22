---
date: '2025-01-05T17:15:59+08:00'
title: 'Taiwan TinyLLaMA MatFormer'
draft: false
cover:
  image: 'img/tinyllama/cover.png'
  alt: 'cover.png'
params:
  math: true
tags: ['TinyLLaMA']
categories: 'Project'
description: 'Implementing MatFormer to Taiwan TinyLLaMA'
summary: "Implementing MatFormer to Taiwan TinyLLaMA"
weight: 10
---

用更少的資料來訓練俄羅斯套娃版的 Taiwan TinyLLaMA。
## MatFormer
因為參數量大多集中在 MLP 層當中，MatFormer 透過減少 MLP 的 intermediate dimension 來減少參數，並一次訓練很多個模型。
## Concept
MatFormer 需要大量的資料作預訓練。要想辦法讓預訓練的 pretrain weight 能夠直接拿來用。必須要滿足兩個條件:
1. intermediate vector 輸出是 decreasing 的，這樣才能套娃。
2. 經過 reordering 之後，可以直接拿來用。也就是說，reordering 後和之前需要達成一樣的 operation。
MatFormer 並沒有滿足任何一種條件， FlexTron 只有滿足第一點。
接下來，我們來觀察 LLaMA 的 MLP 層:
```python
class LlamaMLP(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.config = config
        self.hidden_size = config.hidden_size
        self.intermediate_size = config.intermediate_size
        self.gate_proj = nn.Linear(self.hidden_size, self.intermediate_size, bias=config.mlp_bias)
        self.up_proj = nn.Linear(self.hidden_size, self.intermediate_size, bias=config.mlp_bias)
        self.down_proj = nn.Linear(self.intermediate_size, self.hidden_size, bias=config.mlp_bias)
        self.act_fn = ACT2FN[config.hidden_act]

    def forward(self, x):
        down_proj = self.down_proj(self.act_fn(self.gate_proj(x)) * self.up_proj(x))
        return down_proj
```
我們的目標是讓 intermediate vector (也就是 ```self.act_fn(self.gate_proj(x)) * self.up_proj(x)```) 是 decreasing 的，所以我們要將 MLP 層當中的 gate_proj 和 up_proj 的 row 進行 permutation; 並且要讓 reordering 之後的結果和原本的結果一樣，所以要將 down_proj 的 column 進行 permutation。
因此在 calibration 的時候，我們要先統計 intermediate vector 在 dimension 維度上的分佈，然後再對上述的 weight matrix 進行 permutation 使的 intermediate vector 輸出沿著 dimension 維度 decreasing 的。

## Model
從 transformers 當中複製 ```modeling_llama``` 到 ```model.py```當中，俄羅斯套娃中只要更改
```LlamaMLP``` 就好。
scale 的設定就看要訓練幾個套娃，然後隨機選擇一個 scale。
```python
class LlamaMLP(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.config = config
        self.hidden_size = config.hidden_size
        self.intermediate_size = config.intermediate_size
        self.gate_proj = nn.Linear(self.hidden_size, self.intermediate_size, bias=config.mlp_bias)
        self.up_proj = nn.Linear(self.hidden_size, self.intermediate_size, bias=config.mlp_bias)
        self.down_proj = nn.Linear(self.intermediate_size, self.hidden_size, bias=config.mlp_bias)
        self.act_fn = ACT2FN[config.hidden_act]
        

    def forward(self, x):
        scale = [self.intermediate_size, 2048]
        scale = random.choice(scale)
        gate_proj = F.linear(x[..., : scale], self.gate_proj.weight[:, :scale])
        up_proj = F.linear(x[..., : scale], self.up_proj.weight[:, :scale])
        x = self.act_fn(gate_proj) * up_proj
        down_proj = F.linear(x[..., : scale], self.down_proj.weight[:, :scale])
        # down_proj = self.down_proj(self.act_fn(self.gate_proj(x)) * self.up_proj(x))
        return down_proj, x
```
## Permutation
這部分有三個步驟:
1. 取得 pretrained weight 並讓他除可以輸出 intermediate vector 方便統計
2. 紀錄 intermediate vector 的分佈 (這裡只需要跑 512 個 sample 就好)
3. 統計完後做 reordering
4. 測試做完 reordering 後模型有沒有壞掉
### 更改 pretrained weight 的輸出
### 統計 intermediate vector 的分佈
### 對模型參數做 reordering
### 測試模型


## Training