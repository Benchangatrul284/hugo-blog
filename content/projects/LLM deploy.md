---
date: '2025-01-05T17:15:59+08:00'
title: 'Deploying LLM with Chat UI and vLLM'
draft: false
cover:
  image: 'img/tinyllama/cover.png'
  alt: 'cover.png'
params:
  math: true
tags: ['TinyLLaMA']
categories: 'Project'
description: 'Paper of Matformer initialization of Taiwan SLM'
summary: "Paper of Matformer initialization of Taiwan SLM"
weight: 10
---

# 後端
在 backend 部分，我們利用 vLLM 來當作 inference engine。這裡會用最簡單的 docker 來完成，在 terminal 打開:

```bash
docker run --gpus all -v D:\huggingface:/root/.cache/huggingface -p 8000:8000 --ipc=host vllm/vllm-openai --model benchang1110/Qwen2.5-Taiwan-1.5B-Instruct --gpu-memory-utilization 0.5
```

```D:\huggingface:/root/.cache/huggingface``` 是用來掛載 model 的地方，可以自己設定。

# 前端
在 frontend 部分，我們使用了 ChatUI 來做為使用者介面。會需要用 mongodb 來儲存使用者的對話紀錄。在 terminal 打開:

```bash
docker run -d -p 27017:27017 --name mongo-chatui mongo:latest
```
接下來，我們需要在 ChatUI 的資料夾下，打開 terminal 分別執行:

```bash
npm run host
```

```host``` 是用來將 ip expose 出來，要在 ```package.json``` 裡面設定。

```json
"scripts": {
		"dev": "vite dev",
		"host": "vite --host", // add this line
		"build": "vite build",
		"preview": "vite preview",
		"check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
		"check:watch": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch",
		"lint": "prettier --check . && eslint .",
		"format": "prettier --write .",
		"test": "vitest",
		"updateLocalEnv": "node --loader ts-node/esm scripts/updateLocalEnv.ts",
		"populate": "vite-node --options.transformMode.ssr='/.*/' scripts/populate.ts",
		"prepare": "husky"
	},
```

而在 ```vite.config.ts``` 裡面，要設定 ```server``` 的部分:

```typescript
server: {
		open: "/",
		port: 80,
		allowedHosts: ['qwentaiwan.ddns.net'],  // 將此行新增到 server 對象中
	},
```

在 .env.local 裡面，要設定模型相關的參數:

```json
MONGODB_URL=mongodb://localhost:27017
HF_TOKEN=<hf_token>
MODELS=`[
  {
    "name": "benchang1110/Qwen2.5-Taiwan-1.5B-Instruct",
    "id": "benchang1110/Qwen2.5-Taiwan-1.5B-Instruct",
    "preprompt": "你是 Qwen-Taiwan-1.5B, 來自台灣，全名福爾摩沙台灣。你是一位有幫助的助手。",
    "chatPromptTemplate": "",
    "parameters": {
      "temperature": 0.1,
      "max_new_tokens": 4096,
    },
    "endpoints": [{
      "type" : "openai",
      "baseURL": "http://localhost:8000/v1",
      "extraBody": {
        "repetition_penalty": 1.1,
        "temperature": 0.1,
      }
    }]
  }
]`
```

最後在 teminal 打開:

```bash
npm run host
```


# Evaluation
```bash
lm_eval 