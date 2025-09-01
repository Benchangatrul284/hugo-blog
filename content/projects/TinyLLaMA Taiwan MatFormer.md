---
date: '2025-01-05T17:15:59+08:00'
title: 'Taiwan TinyLLaMA MatFormer'
draft: True
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
## MatFormer Initialization
因為參數量大多集中在 MLP 層當中，MatFormer 透過減少 MLP 的 intermediate dimension 來減少參數，並一次訓練很多個模型。
<!-- 加上目錄 -->
## Table of Contents
1. [Concept](#concept)
2. [Analysis](#analysis)
3. [Permutation](#permutation)
4. [Truncation](#truncation)
5. [Evulation](#evulation)

## Concept
MatFormer 需要大量的資料作預訓練。要想辦法讓預訓練的 pretrain weight 能夠直接拿來用。必須要滿足兩個條件:
1. intermediate activation 輸出是 decreasing 的，這樣才能套娃。
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
我們的目標是讓 intermediate activation (也就是 ```self.act_fn(self.gate_proj(x)) * self.up_proj(x)```) 是 decreasing 的，所以我們要將 MLP 層當中的 gate_proj 和 up_proj 的 row 進行 permutation; 並且要讓 reordering 之後的結果和原本的結果一樣，所以要將 down_proj 的 column 進行 permutation。
因此在 calibration 的時候，我們要先統計 intermediate activation 在 dimension 維度上的分佈，然後再對上述的 weight matrix 進行 permutation 使的 intermediate activation 輸出沿著 dimension 維度 decreasing 的。

### Model
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

## Analysis
這部分有三個步驟:
1. 取得 pretrained weight 並讓他除可以輸出 intermediate activation 方便統計
2. 紀錄 intermediate activation 的分佈 (這裡只需要跑 512 個 sample 就好)
3. 統計完後做 reordering
4. 測試做完 reordering 後模型有沒有壞掉

### 更改 pretrained weight 的輸出
這個步驟稍微麻煩，在最上面的 inference code 加上:
```python
from model import LlamaForCausalLM
model = LlamaForCausalLM.from_pretrained("reordered_model",attn_implementation="flash_attention_2",device_map=device,torch_dtype=torch.bfloat16)
model.config.output_intermediate = True
```
修改模型的 config 檔讓模型輸出每一層的 intermediate activation。  
接下來去 ```model.py``` 裡面依序修改 LlamaForCaualLM 、LlamaModel、LlamaDecoderLayer，增加輸出 intermediate activation 的功能。
在 LlamaForCausalLM 的 forward function 裡面加上:
```python
  output_intermediate = output_intermediate if output_intermediate is not None else self.config.output_intermediate
```
會根據 config 的參數設定是否要輸出 intermediate activation。
最後 return 因為多了 intermediate activation，所以要多 return 一個 intermediate activation 的 tuple of tensors，為了符合 transformers 的 output 規範，所以要多 return 一個 custom_CausalLM_output。
```python
from transformers.utils import ModelOutput
@dataclass
class custom_CausalLM_output(ModelOutput):
    loss: Optional[torch.FloatTensor] = None
    logits: torch.FloatTensor = None
    past_key_values: Optional[Tuple[Tuple[torch.FloatTensor]]] = None
    hidden_states: Optional[Tuple[torch.FloatTensor, ...]] = None
    attentions: Optional[Tuple[torch.FloatTensor, ...]] = None
    intermediates: Optional[Tuple[torch.FloatTensor, ...]] = None
```
最後加上:
```python
return custom_CausalLM_output(
            loss=loss,
            logits=logits,
            past_key_values=outputs.past_key_values,
            hidden_states=outputs.hidden_states,
            attentions=outputs.attentions,
            intermediates=outputs.intermediates,
        )
```
在 LlamaModel 的 forward function 裡面加上:
```python
def forward(
        self,
        input_ids: torch.LongTensor = None,
        attention_mask: Optional[torch.Tensor] = None,
        position_ids: Optional[torch.LongTensor] = None,
        past_key_values: Optional[Cache] = None,
        inputs_embeds: Optional[torch.FloatTensor] = None,
        use_cache: Optional[bool] = None,
        output_attentions: Optional[bool] = None,
        output_intermediate: Optional[bool] = None, # add this line
        output_hidden_states: Optional[bool] = None,
        return_dict: Optional[bool] = None,
        cache_position: Optional[torch.LongTensor] = None,
        **flash_attn_kwargs: Unpack[FlashAttentionKwargs],
    ) -> Union[Tuple, custom_output]:
        output_intermediate = output_intermediate if output_intermediate is not None else self.config.output_intermediate
```
LlamaModel 的 forward function 會跑過所有的 decoder layer，然後將 hidden_states, self_attns, intermediate_activations 這三個 tuple 存起來。
```python
# decoder layers
all_hidden_states = () if output_hidden_states else None
all_self_attns = () if output_attentions else None
all_intermediate_activations = () if output_intermediate else None # add this line

for decoder_layer in self.layers[: self.config.num_hidden_layers]:
    if output_hidden_states:
        all_hidden_states += (hidden_states,)

    if self.gradient_checkpointing and self.training:
        layer_outputs = self._gradient_checkpointing_func(
            decoder_layer.__call__,
            hidden_states,
            causal_mask,
            position_ids,
            past_key_values,
            output_attentions,
            output_intermediate, # add this line
            use_cache,
            cache_position,
            position_embeddings,
        )
    else:
        layer_outputs = decoder_layer(
            hidden_states,
            attention_mask=causal_mask,
            position_ids=position_ids,
            past_key_value=past_key_values,
            output_attentions=output_attentions,
            output_intermediate=output_intermediate, # add this line
            use_cache=use_cache,
            cache_position=cache_position,
            position_embeddings=position_embeddings,
            **flash_attn_kwargs,
        )

    hidden_states = layer_outputs[0]

    if output_attentions:
        all_self_attns += (layer_outputs[1],)

    # intermediate activations must be the last element in the tuple
    if output_intermediate:
        all_intermediate_activations += (layer_outputs[-1],) # add this line
```
在 LlamaDecoderLayer 的 forward function 裡面加上:
```python
def forward(
    self,
    hidden_states: torch.Tensor,
    attention_mask: Optional[torch.Tensor] = None,
    position_ids: Optional[torch.LongTensor] = None,
    past_key_value: Optional[Cache] = None,
    output_attentions: Optional[bool] = False,
    output_intermediate: Optional[bool] = False, # add this line
    use_cache: Optional[bool] = False,
    cache_position: Optional[torch.LongTensor] = None,
    position_embeddings: Optional[Tuple[torch.Tensor, torch.Tensor]] = None,  # necessary, but kept here for BC
    **kwargs: Unpack[FlashAttentionKwargs],
  ) -> Tuple[torch.FloatTensor, Optional[Tuple[torch.FloatTensor, torch.FloatTensor]]]:
    residual = hidden_states

    hidden_states = self.input_layernorm(hidden_states)

    # Self Attention
    hidden_states, self_attn_weights = self.self_attn(
        hidden_states=hidden_states,
        attention_mask=attention_mask,
        position_ids=position_ids,
        past_key_value=past_key_value,
        output_attentions=output_attentions,
        use_cache=use_cache,
        cache_position=cache_position,
        position_embeddings=position_embeddings,
        **kwargs,
    )
    hidden_states = residual + hidden_states

    # Fully Connected
    residual = hidden_states
    hidden_states = self.post_attention_layernorm(hidden_states)
    hidden_states, intermedate_activation = self.mlp(hidden_states) # modify this line
    hidden_states = residual + hidden_states

    outputs = (hidden_states,)
    if output_attentions:
        outputs += (self_attn_weights,)
      
    if output_intermediate: # add this line
        outputs += (intermedate_activation,)
        
    return outputs
```
MLP 的 forward function 如上面所述就不再貼上。
### 統計 intermediate activation 的分佈
```python
with torch.no_grad():
    # iterate through the dataset
    for example in tqdm(dataloader):
        input_ids = example['input_ids'].to(device)
        attention_mask = example['attention_mask'].to(device)
        output = model(input_ids=input_ids, attention_mask=attention_mask)
        for i in range(model.config.num_hidden_layers):
            layer_intermediate = output.intermediates[i] #(B,L,D)
            layer_intermediate = layer_intermediate.abs()
            layer_intermediate = layer_intermediate.sum(dim=(0,1)) #(D,)
            intermediate_sum_dict[i] = intermediate_sum_dict.get(i, 0) + layer_intermediate.detach().cpu()
    intermediate_sum_dict = {k: v / (len(lm_datasets)*2048) for k, v in intermediate_sum_dict.items()}

# save the intermediate sum
with open("intermediate_sum.pkl", "wb") as f:
    pickle.dump(intermediate_sum_dict, f)
```
我們只取 512 個 sample，並將這些 samples group 成 2048 個 tokens 一組，然後將這些 tokens 的 intermediate activation 的絕對值加總起來，最後除以總共的 tokens 數量，得到每一個 dimension 的平均值。

然後經過 visualization 之後，我們可以看到 intermediate activation 的分佈，並且可以看到哪些 dimension 是比較重要的。

```python
import torch
import pickle
import matplotlib.pyplot as plt
import numpy as np
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("--sort", action='store_true', help="Run the main execution code")
args = parser.parse_args()


if __name__ == '__main__':
    root_dir = 'sorted_images' if args.sort else 'images'
    # open the intermediate sum dict
    intermediate_sum_dict = pickle.load(open("intermediate_sum.pkl", "rb"))
    sorted_index_dict = pickle.load(open("sorted_index.pkl", "rb"))
    
    
    for key, value in intermediate_sum_dict.items():
        intermediate = value.to(torch.float32).numpy()
        if args.sort:
            sorted_index = sorted_index_dict[key]
            intermediate = intermediate[sorted_index]
            
        size = int(np.ceil(np.sqrt(intermediate.size)))
        intermediate_padded = np.pad(intermediate, (0, size**2 - intermediate.size), mode='constant').reshape(size, size)
        print(intermediate_padded)
        
        # Calculate standard deviation and mean
        std_dev = intermediate.std()
        mean_val = intermediate.mean()
        
        # plot this intermediate sum using heat map
        plt.figure()
        plt.imshow(intermediate_padded, aspect='auto')
        plt.colorbar()
        plt.title(f"Layer {key}")
        
        # Add text annotations for standard deviation and mean
        plt.text(0.05, 0.95, f'Std Dev: {std_dev:.4f}', transform=plt.gca().transAxes, fontsize=12, verticalalignment='top', color='white')
        plt.text(0.05, 0.90, f'Mean: {mean_val:.4f}', transform=plt.gca().transAxes, fontsize=12, verticalalignment='top', color='white')
        
        plt.savefig(f"{root_dir}/layer_{key}.png")
        
        # Print standard deviation and mean
        print(f"Standard Deviation: {std_dev}")
        print(f"Mean: {mean_val}")
```

```bash
python visualize_intermediate.py
```
分布如下圖，發現蠻多明顯的 outlier，這些 outlier 一定要保留不能被丟掉。
![distribution](/img/MatFormer/distribution.png)

```bash
python visualize_intermediate.py --sort
```
經過對 intermediate activation 的排序之後，可以看到 outlier 都在前幾個 dimension 了。這樣就可以放心的把後面幾個 dimension 的 weight 給丟掉。
![sorted_distribution](/img/MatFormer/sorted-distribution.png)
## Permutation
先讀入剛剛存的 intermediate_sum_dict 和模型的參數，接下來對 gate_proj 和 up_proj 的 row 做 reordering，對 down_proj 的 column 做 reordering 並存成新的模型。
```python
import pickle
import torch
import transformers
from transformers import AutoModelForCausalLM

if __name__ == '__main__':
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    model = AutoModelForCausalLM.from_pretrained("<your model>",attn_implementation="flash_attention_2",device_map=device,torch_dtype=torch.bfloat16)
    model.eval()
    # get the layers of the model
    sd = model.state_dict()
    sd_keys = sd.keys()
    mlp_keys = [key for key in sd_keys if "mlp" in key]
    gate_keys = [key for key in sd_keys if "gate_proj" in key]
    up_keys = [key for key in sd_keys if "up_proj" in key]
    down_keys = [key for key in sd_keys if "down_proj" in key]
    print(mlp_keys, gate_keys, up_keys, down_keys)
    # get the order of the layers
    with open("sorted_index.pkl", "rb") as f:
        sorted_index_dict = pickle.load(f)

    for layer, key in enumerate(gate_keys):
        order = sorted_index_dict[layer]
        sd[key] = sd[key][order]
    
    for layer, key in enumerate(up_keys):
        order = sorted_index_dict[layer]
        sd[key] = sd[key][order]
    
    for layer, key in enumerate(down_keys):
        order = sorted_index_dict[layer]
        sd[key] = sd[key][:,order]
    
    # save the reordered model
    model.load_state_dict(sd)
    model.save_pretrained("reordered_model")
```

## Truncation
這裡我們要對模型做 truncation，也就是只取部分的權重，這樣才能讓模型變小。我們會存兩個比較小的模型，分別是 intermediate_size = 4096 (small) 和 intermediate_size = 2048 (tiny)。
這裡示範 small 的版本，tiny 的版本只要將 intermediate_size 改成 2048 就好。
因為除了 intermediate_size 之外，其他的參數都不用改，所以直接 load 原本 base model 的 config，然後設定 intermediate_size = 4096。接下來複製剛剛 ```reordered_model``` 的模型，然後將模型的 weight 載入，但是只取部分的權重。

```python
import transformers
import torch
from transformers import LlamaForCausalLM, LlamaConfig


# if reorder is true, load the reordered model else load the base model

if __name__ == '__main__':
    config = LlamaConfig.from_pretrained('benchang1110/Taiwan-tinyllama-v1.1-base')
    config.intermediate_size = 4096
    model = LlamaForCausalLM(config)
    
    base_model = LlamaForCausalLM.from_pretrained('reordered_model') if args.reorder else LlamaForCausalLM.from_pretrained('benchang1110/Taiwan-tinyllama-v1.1-base')
    model_sd = model.state_dict()
    base_model_sd = base_model.state_dict()
    
    assert len(model_sd) == len(base_model_sd)
    
    # load the state dict into model
    for k in model_sd.keys():
        print("Loading key: ", k)
        print(f"Shape of layer {k} : {model_sd[k].shape}")
        print(f"Shape of layer {k} (base model): {base_model_sd[k].shape}")
        if model_sd[k].shape == base_model_sd[k].shape:
            model_sd[k] = base_model_sd[k]
        elif "mlp" in k:
            print("Loading MLP")
            if "up_proj" in k or "gate_proj" in k:
                model_sd[k] = base_model_sd[k][:config.intermediate_size,:]
            else:
                model_sd[k] = base_model_sd[k][:,:config.intermediate_size]
                
    model.load_state_dict(model_sd)
    
    model.save_pretrained('ordered_small_model_fp32')
    model = LlamaForCausalLM.from_pretrained('ordered_small_model_fp32', torch_dtype=torch.bfloat16)
    model.save_pretrained('ordered_small_model_bf16')
    
    
```


最後來總結一下整個流程:
1. 先讀入 pretrained weight 並讓他輸出 intermediate activation 方便統計。
2. 紀錄 intermediate activation 的分佈。此時的 MLP 層的 weight 還沒有 reordering，MLP 層的運算長這樣:
![original](/img/MatFormer/original.png)
3. 統計完後做 reordering。MLP 層的運算長這樣:
![reordered](/img/MatFormer/final.png)
4. Truncation。將 MLP 層的 weight 進行 truncation，讓模型變小。MLP 層的運算長這樣:
![truncated](/img/MatFormer/truncate.png)

## Evulation
我們簡單用 ```perplexity``` 來評估模型的好壞，perplexity 越小代表模型越好。採用的資料集是台灣的維基百科。

```python
import os
os.environ["CUDA_VISIBLE_DEVICES"] = "0"
import datasets
from datasets import load_dataset
import transformers
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch
import argparse
import evaluate
from torch.nn import CrossEntropyLoss
from tqdm import tqdm
from torch.utils.data import DataLoader

from transformers import DataCollatorForLanguageModeling, DataCollatorForSeq2Seq

parser = argparse.ArgumentParser()
parser.add_argument("--model_name_or_path", type=str, default="benchang1110/Taiwan-tinyllama-v1.1-tiny")
parser.add_argument("--device", type=str, default="cuda")
parser.add_argument("--sample", type=int, default=None)
args = parser.parse_args()

def tokenize_function(examples):
    return tokenizer(examples["text"],
            add_special_tokens=False,
            padding=True,
            truncation=True,
            max_length=1024,
            return_tensors="pt",
            return_attention_mask=True)
    
if __name__ == '__main__':
    model = AutoModelForCausalLM.from_pretrained(args.model_name_or_path, torch_dtype=torch.bfloat16, device_map=args.device,attn_implementation="flash_attention_2")
    tokenizer = AutoTokenizer.from_pretrained("benchang1110/Taiwan-tinyllama-v1.1-base", use_fast=True)
    tokenizer.pad_token = tokenizer.eos_token
    
    dataset = load_dataset("lianghsun/wikipedia-zh-742M", split='train[:1000]')
    dataset = dataset.map(tokenize_function, batched=True, remove_columns=dataset.column_names, num_proc=32)
    
    
    encoded_texts = dataset["input_ids"]
    attn_masks = dataset["attention_mask"]

    ppls = []
    loss_fct = CrossEntropyLoss(reduction="none")
    dataloader = DataLoader(dataset, batch_size=1, collate_fn=DataCollatorForSeq2Seq(tokenizer, return_tensors="pt", padding='longest'))
    
    for sample in tqdm(dataloader):
        encoded_batch = sample["input_ids"].to(args.device)
        attn_mask = sample["attention_mask"].to(args.device)
        labels = encoded_batch

        with torch.no_grad():
            out_logits = model(encoded_batch, attention_mask=attn_mask).logits

        shift_logits = out_logits[..., :-1, :].contiguous()
        shift_labels = labels[..., 1:].contiguous()
        shift_attention_mask_batch = attn_mask[..., 1:].contiguous()

        perplexity_batch = torch.exp(
            (loss_fct(shift_logits.transpose(1, 2), shift_labels) * shift_attention_mask_batch).sum(1)
            / shift_attention_mask_batch.sum(1)
        )

        ppls += perplexity_batch.tolist()

    
    print(sum(ppls) / len(ppls))
    print(ppls) 
```

| base | MIT-small(800M) | MIT-tiny(600M) | Brute-small(800M) | Brute-tiny(600M) |
|----------|----------|----------|----------|----------|
|   6.183 |   11.871  |   48.7425  |   19007.68  |   20346.688  |

