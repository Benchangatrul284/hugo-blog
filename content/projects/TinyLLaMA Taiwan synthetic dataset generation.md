---
date: '2025-01-05T17:15:59+08:00'
title: 'Taiwan TinyLLaMA synthetic dataset generation'
draft: false
cover:
  image: 'img/tinyllama/cover.png'
  alt: 'cover.png'
params:
  math: true
tags: ['TinyLLaMA']
categories: 'Project'
description: 'Generating synthetic dataset of Taiwan TinyLLaMA'
summary: "Generating synthetic dataset of Taiwan TinyLLaMA"
weight: 10
---

## Introduction
因為繁體中文的對話集偏少，大部分都是直接從現有的英文翻譯過來，或甚至是簡體中文做 CC 轉換，又剛好 TAIDE 釋出了新的模型，所以趁這個機會用 [taide/Llama3-TAIDE-LX-8B-Chat-Alpha1](https://huggingface.co/taide/Llama3-TAIDE-LX-8B-Chat-Alpha1) 來生出一些繁體中文的對話集。而問題就從現有的 dataset 去取得。

## Inference Server
我們使用 [vllm](https://github.com/vllm-project/vllm) 作為 inference server，安裝上沒有遇到甚麼問題。
安裝後在 terminal 輸入:
```bash
vllm serve taide/Llama3-TAIDE-LX-8B-Chat-Alpha1 --dtype=half --tensor-parallel-size 8 --max_model_len 2048
```
這樣就可以用和 OpenAI API 一樣的方式來使用這個模型，而 base url 是 ```http://0.0.0.0:8000/v1```。

## Generation
在 main function 裡面，我們會先將 dataset load 進來，然後取得每段對話的第一個句子的 content，也就是 prompt。我們這裡利用 ```ThreadPoolExecutor``` 來同時向 inference server 丟 request。然後將這些 prompt 送進 inference server 來取得回答，最後將這些對話存成 json 檔。

```python
if __name__ == '__main__':
    if os.path.exists(args.export):
        os.remove(args.export)
    
    client = OpenAI(
        base_url="http://0.0.0.0:8000/v1",
        api_key="EMPTY"
    )   
    system = '你是一個來自台灣的助理，樂於以台灣人的立場幫助使用者，會用繁體中文回答問題。'
    dataset = load_dataset('yentinglin/TaiwanChat',split=args.percent)
    print('Length of dataset:',len(dataset))
    
    with open(os.path.join(args.export), 'a') as outfile:
        outfile.write('[\n')
        outfile.flush()
        batch = []
        for item in tqdm(dataset):
            # add the prompt to the batch
            try:
                prompt = item['messages'][0]['content']
                completion = None
                if len(batch) < args.concurrency:
                    batch.append(prompt)
                    continue
                with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
                    results = executor.map(generate, batch)
                for r in results:
                    # print(json.dumps(r, ensure_ascii=False,indent=4),',', sep='')
                    outfile.write(json.dumps(r, ensure_ascii=False,indent=4))
                    outfile.write(',\n')
                    outfile.flush()
                batch = []
            except Exception as e:
                batch = []
                continue
```
在 generate() 裡面，我們會將 prompt 送進 inference server 來取得回答，然後將回答和原本的 prompt 組成 list of dictionary，最後回傳這個 list。
```python
def generate(prompt):
    completion = client.chat.completions.create(
        model="taide/Llama3-TAIDE-LX-8B-Chat-Alpha1",
        messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ]
    )
    response = completion.choices[0].message.content
    conversation = []
    conversation.append({"content": prompt,"role": "user"})
    conversation.append({"content": response,"role": "assistant"})
    return conversation
```


## Post Process
這一步要將生成出來的 json 檔上傳至 huggingface，並且對資料做一些處理。因為模型有時候輸出會不斷的重複 (repitition)，像是:
```
除了整形手術 女性可以藉由化妝 穿著 髮型來戲劇性地改變她的外觀  
除了整形手術 女性可以藉由化妝 穿著 髮型來戲劇性地改變她的外觀  
除了整形手術 女性可以藉由化妝 穿著 髮型來戲劇性地改變她的外觀 
```
所以我們要將這些重複的句子刪掉。判斷的標準就是去判斷整段回答，只有出現一次的 token 的比例是多少，如果低於 80% 就刪掉這個句子。這樣就可以避免重複的問題。

```python
filenames = ['TaiwanChat.json']
dataset = Dataset.from_generator(lambda: gen(filenames), cache_dir="./")
dataset = dataset.map(clean_newline, batched=True) # remove multiple newlines
original_len = len(dataset)
dataset = dataset.filter(function=count_elements) # remove the sample with duplicated text
# dataset.push_to_hub('benchang1110/TaiwanChat')
```
從 json 檔讀入至 dataset:
```python
def gen(filenames):
    for filename in filenames:
        with open(filename, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
                for i in data:
                    yield {"conversation": i}
            except:
                print(f'Error in {filename}')
                pass
```
去掉多餘的換行符號
```python
def clean_newline(batch):
    # make multiple times of \n to a signle \n
    batch['conversation'] = [[{'content': regex.sub(r'\n+', '\n', message['content']), 'role': message['role']} for message in conversation] for conversation in batch['conversation']]
    return batch
```
判斷是否為一直重複的句子
```python
def count_elements(sample,threshold=0.2):
    # print(sample['conversation'][1]['content'])
    # sample is a list of dictionary, select the 'content' key
    sample = regex.sub(r'\p{P}+', ' ', sample['conversation'][1]['content'])  # Remove all punctuation characters
    count = {}
    total_words = 0
    words = sample.split()
    for word in words:
        if any('\u4e00' <= char <= '\u9fff' for char in word):  # Check if the word contains Chinese characters
            for char in word:
                count[char] = count.get(char, 0) + 1
            total_words += len(word)  # Count each Chinese character as a word
        else:
            count[word] = count.get(word, 0) + 1
            total_words += 1  # Count each English word as a word
    if total_words == 0:
        return False     
    if len(count.keys())/ total_words < threshold :
        print(sample)
        return False
    return True
```

## Conclusion
最後生成的 dataset 的連結在這裡 [Taide Collection](https://huggingface.co/collections/benchang1110/taide-66d1b860daa6402d5638f7cd) ，大概共 500 萬筆對話，生成時間大概是一個禮拜 (8 張 V100)，下一步: 多輪對話集!