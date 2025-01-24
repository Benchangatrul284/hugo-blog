---
date: '2025-01-05T17:15:59+08:00'
title: 'TaiVision Dataset Preperation'
draft: false
cover:
  image: 'img/TaiVision/cover.png'
  alt: 'cover.png'
params:
  math: true
tags: ['TaiVision']
categories: 'Project'
description: 'Preperation of TaiVision dataset'
summary: "Preperation of TaiVision dataset"
weight: 20
---


## Introduction
目前在 huggingface 找不到繁體中文的文字加圖片的 dataset，倒是英文的蠻多的，但是格式都蠻亂的 (圖片要額外去其他地方下載)。要訓練一個繁體中文的視覺語言模型之前，一定要先取得適合的資料集。我們會利用 [Taiwan LLaMA](yentinglin/Llama-3-Taiwan-8B-Instruct-128k) 做翻譯，然後再加上整理後的圖片，方便之後訓練模型。

## Dataset
- [TaiVision-pretrain-1M-v1.0](#TaiVision-pretrain-1M-v1.0)
  - [LLaVA-Pretrain](#LLaVA-Pretrain)
  - [Llava-CC3M](#Llava-CC3M)
- [TaiVision-pretrain-1M-v2.0](#TaiVision-pretrain-1M-v2.0)
  - [ShareGPT4V](#ShareGPT4V)


## [TaiVision-pretrain-1M-v1.0](https://huggingface.co/datasets/benchang1110/TaiVision-pretrain-1M-v1.0)
由下面兩個 dataset 組成，皆是簡答題，用於第一步的訓練 (feature alignment)。
```python
[ { "content": "用直接明瞭的方式描述圖片內容", "role": "assistant" }, { "content": "在婦女遊行中，我們看到的53個最吸引眼球的抗議標語", "role": "user" } ]
```

### [LLaVA-Pretrain](https://huggingface.co/datasets/liuhaotian/LLaVA-Pretrain)
這個資料集大部分是短短回答而已，且問題和圖片內容沒有相關，類似做 image captioning。image 的 column 是給圖片的 path 而圖片有放在 huggingface 上面，所以還算好處理。
但我在 huggingface 上面看到已經有人把 image column 轉成 parquet 格式了 ([連結](https://huggingface.co/datasets/theblackcat102/llava-pretrain))，所以直接少掉一個步驟。


如何利用 vllm 來生成對話和[生成對話集](../taivision-dataset)很像，這裡不多加贅述。
```python
from datasets import load_dataset
import datasets
from openai import OpenAI

def translation_table():
    import random
    """
    translate the query from English to Chinese
    """
    list_text = []
    list_text.append("以簡明扼要的方式講解圖片")
    list_text.append("用通俗易懂的語言闡述圖片")
    list_text.append("用直接明瞭的方式描述圖片內容")
    list_text.append("以簡單直接的方式說明圖像")
    list_text.append("清楚簡潔地解釋圖片中的訊息")
    list_text.append("簡單易懂地描述圖片中的細節")
    list_text.append("用簡單而明確的語言說明圖片含義")
    list_text.append("明確而簡單地陳述圖片的主要訊息")
    list_text.append("描述圖片")
    list_text.append("描述照片發生了甚麼事")
    list_text.append("概述圖片的核心內容")
    list_text.append("以直觀的方式講解圖片")
    list_text.append("用簡單的語言說明圖片中的重點")
    list_text.append("簡潔地傳達圖片的主要資訊")
    list_text.append("用易懂的方式描述圖片的情境")
    list_text.append("說明圖片中的關鍵細節")
    list_text.append("清晰地傳達圖片中的含義")
    list_text.append("簡單地解釋圖片中的內容")
    list_text.append("用簡單的方式描述圖片的意圖")
    list_text.append("陳述圖片中的主要訊息")
    # return a random text
    return list_text[random.randint(0, len(list_text)-1)]

def translate(sample):
    messages = []
    messages.append({"content": translation_table(),"role": "user"})
    # the conversations field in the original dataset is a string, very wierd.....
    completion = client.chat.completions.create(
            model="yentinglin/Llama-3-Taiwan-8B-Instruct-128k",
            messages= [
                        {"role": "system", "content": system},
                        {"role": "user", "content": "將下面英文翻譯成語意通順的完整繁體中文句子，做翻譯就好，不要多做解釋。\n" + sample['conversations'].split('{"from": "gpt", "value": "')[1].replace('"}]','')},
                     ]
        )
    messages.append({"content": completion.choices[0].message.content, "role": "assistant"})
    return {"conversations": messages}

if __name__ == '__main__':
    ds = load_dataset('theblackcat102/llava-pretrain',split='train')
    num_shards = 50
    client = OpenAI(
        base_url="http://0.0.0.0:8000/v1",
        api_key="EMPTY"
    ) 
    system = "你是一位來自台灣的助理。" 
    # split the dataset into shards
    for i in range(num_shards):
        ds_shard = ds.shard(num_shards=num_shards,index=i)
        ds_shard = ds_shard.map(translate,num_proc=256,writer_batch_size=10)
        ds_shard.save_to_disk(f'train/shard_{i}')
        del ds_shard
        
    ds = datasets.concatenate_datasets([datasets.load_from_disk(f'train/shard_{i}') for i in range(10)])
    ds.push_to_hub("benchang1110/llava_pretrain_zhtw",token='<hf_token>')
``` 

### [Llava-CC3M](https://huggingface.co/datasets/liuhaotian/LLaVA-CC3M-Pretrain-595K)

這個資料集挺難搞的，原始 repo 有提供兩個 json 檔，一個是 chat.json 另外一個是 metadata.json，所幸兩者的順序是相同的，我們會從 metadata.json 裡面取得圖片的 relative path，從 chat.json 取得英文的回答然後翻譯成中文。先看一下 main function:

```python
if __name__ == "__main__":
    new_metadata_path = 'train/metadata_chinese.jsonl'
    create_jsonl(new_metadata_path)
    convert_images_to_parquet("train/images")
```
main function 會先在 ```create_jsonl``` 中建立 metadata_chinese.jsonl，內部會有圖片的 relative path 和中文對話，然後再用 ```convert_images_to_parquet``` 將 images 轉成 parquet 格式。

在 ```create_jsonl```中，會讀入 metadata.json 和 chat.json，然後將兩者的資料合併，並且翻譯成中文，最後寫入 metadata_chinese.jsonl。這裡使用了 ```ThreadPoolExecutor``` 來加速處理。
```python
def create_jsonl(new_metadata_path):
    """
    create a new jsonl form converting to parquet file for LLaVA-CC3M-Pretrain-595K dataset
    """
    # read the json file
    def read_json(file_path):
        with open(file_path, 'r') as f:
            data = json.load(f)
        return data

    # write the json file
    def write_json(file_path, data):
        with open(file_path, 'a') as f:
            f.write(json.dumps(data, ensure_ascii=False))
            f.write('\n')
            f.flush()
    
    metadata_path = 'metadata.json'
    chatdata_path = "chat.json"
    if os.path.exists(new_metadata_path):
        os.remove(new_metadata_path)
    
    client = OpenAI(
        base_url="http://0.0.0.0:8000/v1",
        api_key="EMPTY"
    )
       
    system = '你是一個專門將英文翻譯成中文的助理。'
    
    metadata = read_json(metadata_path)
    chatdata = read_json(chatdata_path)
    
    def process_pair(metadata, chatdata):
        # write jsonl file after translation
        data = {"file_name": None, "conversation": None}
        data['file_name'] = os.path.join("images", metadata['image'])
        conversation = []
        conversation.append({"content": translation_table(), "role": "assistant"})
        completion = client.chat.completions.create(
            model="yentinglin/Llama-3-Taiwan-8B-Instruct-128k",
            messages=[
                        {"role": "system", "content": system},
                        {"role": "user", "content": "將下面英文翻譯成文法語意通順的完整繁體中文句子，做翻譯就好，不要多做解釋。\n" + chatdata['conversations'][1]['value']},
                    ]
        )  
        response = completion.choices[0].message.content
        conversation.append({"content": response, "role": "user"})
            
        data['conversation'] = conversation
        write_json(new_metadata_path, data)
        
    with ThreadPoolExecutor(max_workers=512) as executor:
        list(tqdm(executor.map(lambda pair: process_pair(*pair), zip(metadata, chatdata)), total=len(metadata)))
```

建立完 metadata_chinese.jsonl 之後，我們就可以用 ```convert_images_to_parquet``` 來將 images 轉成 parquet 格式。在 parquet 格式當中，圖片的格式是 ```datasets.Image()```，所以我們要先將圖片轉成 ```datasets.Image()``` object 並且 encode。注意這裡 image_field 是和 metadata_chinese.jsonl 長度一樣的 list。最後再將 image_field 加入到 dataset 中，並且將 dataset 存成 parquet 格式。
```python
def convert_images_to_parquet(folder):
    # this will convert a json file to parquet file with datasets.Image() object
    ds = Dataset.from_json(new_metadata_path,split='train')
    # opening image files
    def open_image(file_name):
        # open the image file as datasets.Image() object
        print(f"Opening image: {file_name}")
        feature = datasets.Image()
        return feature.encode_example(Image.open(os.path.join('train', file_name)))

    with ThreadPoolExecutor(max_workers=1000) as executor:
        image_field = list(executor.map(open_image, ds['file_name']))
    
    # adding column to the dataset
    ds = ds.add_column(name="image", column=image_field)
    # cast the Object to image
    ds = ds.cast_column("image", datasets.Image(decode=True))
    
    ds.save_to_disk("train/images.arrow")
    ds.push_to_hub("benchang1110/LLaVA-CC3M-Pretrain-595K_zhtw",token='<hf_token>')
```
最後的最後，因為翻譯是由模型生出來的，我們不希望模型輸出會有這樣的句子:
```
"This is a book" 這句英文的翻譯是中文 "這是一本書"。
```
因此如果當模型輸出含有 ```sequences_to_check = ["中文", "翻譯", "英文"]``` 這三種其中一個，就將這個 sample 剃除。

```python
def remove_refusal(sample):
    return not any(sequence in sample['conversations'][-1]['content'] for sequence in sequences_to_check)
```


## [TaiVision-pretrain-1M-v2.0](https://huggingface.co/datasets/benchang1110/TaiVision-pretrain-1M-v2.0)
這個 dataset 的回答比較長，作為第二步的 feature alignment。assistant 的 respond 依舊和 prompt 沒有關係。
```
[ { "content": "描述圖片發生了甚麼事", "role": "user" }, { "content": "在圖片的中心，一個充滿活力的藍色午餐盤的四個容器裡都裝滿了各種食物。這四個容器中，有兩個是粉紅色的，另外兩個是黃色的，它們排列成2x2的網格。\n\n在頂部左邊的粉紅色容器裡，一片麵包躺著，輕輕地塗上奶油，撒上一把杏仁。麵包被切成矩形，杏仁散落在奶油的表面上。\n\n旁邊在頂部右角的另一個粉紅色容器裡，一種水果混合物。切片的蘋果，白色的內部暴露在外，與多汁的鳳梨塊共享空間。蘋果片和鳳梨塊的顏色與粉紅色的容器形成美麗的對比。\n\n在它們下面的底部左角，藍色盤的黃色容器裡有一個肉丸和一些花椰菜。圓而棕色的肉丸與充滿活力的綠色花椰菜花朵相鄰。\n\n最後，在藍色盤的底部右角，有一個甜點 - 一個巧克力豆餅乾。金黃色的餅乾上點綴著巧克力豆，它們的暗色與餅乾較淺的表面形成鮮明對比。\n\n這些容器在藍色盤上的排列創造了一個視覺上吸引人且平衡的餐點，每個組成部分都整齊地分開，但又成為一個有機整體的一部分。", "role": "assistant" } ]
```

### [ShareGPT4V](https://huggingface.co/datasets/Lin-Chen/ShareGPT4V)
這個資料相當的麻煩，圖片要自己上網下載，且來源很多，甚至有來源已經不開放下載 (meta 的 sam)，要去找別人備份的。
不過我已經把他包成 shell script (不會下載英文 OCR 的圖片):
```bash
cd /your/path/to/TaiVision
cd data
# create zip_files folder to store all the zip files
if [ ! -d "zip_files" ]; then
    mkdir zip_files
fi

# download zip_files/llava_pretrain.zip
if [ ! -d "llava" ]; then
    mkdir llava
    cd llava
    if [ ! -d "llava_pretrain" ]; then
        mkdir llava_pretrain
        cd llava_pretrain
        mkdir images
        # check if the file exists
        if [ ! -f "../../zip_files/llava_pretrain.zip" ]; then
            wget https://huggingface.co/datasets/liuhaotian/LLaVA-Pretrain/resolve/main/images.zip -P ../../zip_files/
            mv ../../zip_files/images.zip ../../zip_files/llava_pretrain.zip # rename the file
        else
            echo "zip file does exist"
        fi
        cd ..
        cd ..
    fi
fi

# donwload ShareGPT4V/share_textvqa.zip ......
# should avoid the text here since it is English?
if [ ! -d "../ShareGPT4V" ]; then
    mkdir ShareGPT4V
    gdown --folder https://drive.google.com/drive/folders/1tCUQ-sq6vdshZVkF0ZeF3K4eztkXJgax
    cd ..
fi


# create folder
if [ ! -d "share_textvqa" ]; then
    mkdir share_textvqa
fi


if [ ! -d "web-celebrity" ]; then
    mkdir web-celebrity
fi

if [ ! -d "web-landmark" ]; then
    mkdir web-landmark
fi

if [ ! -d "wikiart" ]; then
    mkdir wikiart
fi


# coco
if [ ! -d "coco" ]; then
    mkdir coco
    # check if the file exists
    if [ ! -f "./zip_files/train2017.zip" ]; then
        echo "zip file does not exist"
        wget http://images.cocodataset.org/zips/train2017.zip -P ./zip_files/
    else
        echo "zip file does exist"
    fi
fi

# sam
if [ ! -d "sam" ]; then
    mkdir sam
    # check if zip file exists
    if [ ! -f "./zip_files/sharegpt4v_sam.zip" ]; then
        echo "zip file does not exist"
        wget https://huggingface.co/datasets/eyuansu71/sam_sharegpt4v/resolve/main/sharegpt4v_sam.zip -P ./zip_files/
    else
        echo "zip file does exist"
    fi
fi


# download sharegpt4v/....json
if [ ! -d "sharegpt4v" ]; then
    mkdir sharegpt4v
    cd sharegpt4v
    wget https://huggingface.co/datasets/Lin-Chen/ShareGPT4V/resolve/main/share-captioner_coco_lcs_sam_1246k_1107.json?download=true
    wget https://huggingface.co/datasets/Lin-Chen/ShareGPT4V/resolve/main/sharegpt4v_instruct_gpt4-vision_cap100k.json?download=true
    wget https://huggingface.co/datasets/Lin-Chen/ShareGPT4V/resolve/main/sharegpt4v_mix665k_cap23k_coco-ap9k_lcs3k_sam9k_div2k.json?download=true
    cd ..
fi

# download zip_files/gqa.zip
if [ ! -d "gqa" ]; then
    mkdir gqa
    wget https://downloads.cs.stanford.edu/nlp/data/gqa/images.zip -P ./zip_files/
    # unzip images.zip
    mv ./zip_files/images.zip ./zip_files/gqa.zip
fi

#  we skip ocr_vqa and text_vqa since it is in English

# download zip_files/VG_100K.zip and zip_files/VG_100K_2.zip
if [ ! -d "vg" ]; then
    mkdir vg
    cd vg
    if [ ! -d "VG_100K" ]; then
        mkdir VG_100K
        cd VG_100K
        wget https://cs.stanford.edu/people/rak248/VG_100K_2/images.zip -P ../../zip_files/
        mv ../../zip_files/images.zip ../../zip_files/VG_100K.zip
        cd ..
    fi
    cd .. # do nothing, return to the parent directory
    if [ ! -d "VG_100K_2" ]; then
        mkdir VG_100K_2
        cd VG_100K_2
        wget https://cs.stanford.edu/people/rak248/VG_100K_2/images2.zip -P ../../zip_files/
        mv ../../zip_files/images2.zip ../../zip_files/VG_100K_2.zip
        cd ..
    fi
fi
```

下載完後用下面的 script 就能 unzip:
```bash
cd /your/path/to/TaiVision
cd data

# llava pretrain
if [ -d "llava" ]; then
    cd llava
    if [ -d "llava_pretrain" ]; then
        cd llava_pretrain
        if [ -d "images" ]; then
            echo "images folder exists"
            cd images
            unzip ../../../zip_files/llava_pretrain.zip
        fi
        cd ..
        cd ..
        cd ..
    fi
fi

if [ -d "web-celebrity" ]; then
    cd web-celebrity
    unzip ../../ShareGPT4V/web-celebrity.zip
    mkdir images
    cp data/web-celebrity/images/* ./images/
    cd ..
fi

if [ -d "web-landmark" ]; then
    cd web-landmark
    unzip ../../ShareGPT4V/web-landmark.zip
    mkdir images
    cp data/web-landmark/images/* ./images/
    cd ..
fi

if [ -d "wikiart" ]; then
    cd wikiart
    unzip ../../ShareGPT4V/wikiart.zip
    mkdir images
    cp data/wikiart/images/* ./images/
    cd ..
fi


# coco
if [ -d "coco" ]; then
    cd coco
    # check if the file exists
    if [ ! -f "../zip_files/train2017.zip" ]; then
        echo "zip file does not exist, please run download.sh, or run the following command:"
        echo "wget http://images.cocodataset.org/zips/train2017.zip -P ../zip_files/"
    else
        echo "zip file does exist"
        unzip ../zip_files/train2017.zip 
        cd ..
    fi
fi

# sam  # sam/images/sa_1.jpg
if [ -d "sam" ]; then
    cd sam
    # check if zip file exists
    if [ ! -f "../zip_files/sharegpt4v_sam.zip" ]; then
        echo "zip file does not exist, please run download.sh or run the following command:"
        echo "wget https://huggingface.co/datasets/eyuansu71/sam_sharegpt4v/resolve/main/sharegpt4v_sam.zip -P ../zip_files/"
    else
        echo "zip file does exist"
        unzip ../zip_files/sharegpt4v_sam.zip
        mkdir images
        mv  sharegpt4v_sam/ images/
        cd ..
    fi
fi
```

原始的 repo 的文字是 json 檔，這裡記得先將這些 json 檔下載下來，並用下面的程式碼合併成一個 dataset:
```python
'''
read the json file and convert the format into parquet file
'''
import datasets
from datasets import load_dataset
from datasets import disable_caching
from datasets import Features, Value
from datasets import concatenate_datasets
disable_caching()

if __name__ == '__main__':
    # Load the dataset using json format
    ds1 = load_dataset('json', data_files='your/path/to/sharegpt4v_instruct_gpt4-vision_cap100k.json',split='train')
    features = Features({'id': Value(dtype='string', id=None), 
                         'image': Value(dtype='string', id=None), 
                         'conversations': [{'from': Value(dtype='string', id=None), 'value': Value(dtype='string', id=None)}]})
    
    ds2 = load_dataset('json', data_files='data/sharegpt4v/share-captioner_coco_lcs_sam_1246k_1107.json',features=ds1.features,split='train')    
    ds = concatenate_datasets([ds1, ds2])
    # push to hub
    ds.push_to_hub('benchang1110/Sharegpt4V',token = '<hf_token>')
```
接下來和上面一樣，開啟 inference server，開始翻譯，下方是各個圖片來源的張數
| source | number of captions |
| --- | --- |
| coco | 168312 |
| sam | 590479 |
| llava | 588122 |
| wikiart | 500 |
| share_textvqa | 500 |
| web-celebrity | 498 |
| web-landmark | 500 |
| **total** | **1,348,411** |
資料集下載[連結](https://huggingface.co/datasets/benchang1110/ShareGPT4V-zhtw)

翻譯完後，就要把剛剛的圖片轉成 parquet 格式了。這邊的程式碼和上面不太一樣，直接用 map function 來加入 column，我覺得這個方法更直觀一點。這邊要加上
```python
LARGE_ENOUGH_NUMBER = 100
PngImagePlugin.MAX_TEXT_CHUNK = LARGE_ENOUGH_NUMBER * (1024**2)
```
來避免跑到一半 PIL 因為開太多圖片跳 error。
另外還要注意一點是分 shards 來處理 dataset，處理一部分就存到 disk 裡面，否則 MEM 會爆掉。
```python
from datasets import load_dataset, concatenate_datasets
import datasets
import os
from PIL import Image
from PIL import PngImagePlugin
LARGE_ENOUGH_NUMBER = 100
PngImagePlugin.MAX_TEXT_CHUNK = LARGE_ENOUGH_NUMBER * (1024**2)

def open_image(sample):
    # open the image file
    if os.path.exists(os.path.join('data', sample['image'])):
        return {'conversations': sample['conversations'],'image': Image.open(os.path.join('data', sample['image'])).resize((224,224), Image.Resampling.LANCZOS).convert('RGB')}
    else:
        print(f"Image {sample['image']} not found")
        return {'conversations': None, 'image': None}
    
if __name__ == '__main__':
    ds = load_dataset("benchang1110/Sharegpt4V-zhtw", split='train')
    # # split the dataset
    num_shards = 10
    for i in range(num_shards):
        print(f"Processing shard {i}")
        ds_shard = ds.shard(num_shards, i)
        ds_shard = ds_shard.filter(lambda x: x['image'] is not None) # some rows may be None since the translation is not successful
        opened_ds = ds_shard.map(open_image, num_proc=8,remove_columns=ds_shard.column_names)
        opened_ds = opened_ds.cast_column("image", datasets.Image(decode=True))
        opened_ds.save_to_disk(f'train/shard_{i}')
        del opened_ds, ds_shard
    
    translated_shard = concatenate_datasets([datasets.load_from_disk(f'train/shard_{i}') for i in range(num_shards)])
    translated_shard = translated_shard.filter(lambda x: x['conversations'] is not None, num_proc = 8) # some rows may be None since no image is found
    # save to disk
    translated_shard.save_to_disk('upload')
    translated_shard.push_to_hub('benchang1110/TaiVision-pretrain-1M-v2.0', token='<hf_token>')
```
到這裡就大功告成了~ 