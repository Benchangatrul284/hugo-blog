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

### 對模型參數做 reordering
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

### 測試模型


## Training