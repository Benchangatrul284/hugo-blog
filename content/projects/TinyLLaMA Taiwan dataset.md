---
date: '2025-01-05T17:15:59+08:00'
title: 'Taiwan TinyLLaMA Dataset Using Scrapy'
draft: false
cover:
  image: 'img/tinyllama/cover.png'
  alt: 'cover.png'
params:
  math: true
tags: ['TinyLLaMA']
categories: 'Project'
description: 'Collecting Taiwan TinyLLaMA dataset using scrapy'
summary: "Collecting Taiwan TinyLLaMA dataset using scrapy"
weight: 10
---

紀錄如何使用 Scrapy 爬取用來訓練 Taiwan TinyLLaMA 的預訓練資料集。
## How to Start
先安裝 scrapy:
```bash
pip install scrapy
```
然後建立 scrapy 新的專案:
```bash
scrapy startproject crawling
```

進到 ```crawling/crawling/spiders/``` 資料夾，在這個資料夾當中可以定義後面需要的 spiders，如下面範例程式碼所示:
```python
from scrapy.spiders import CrawlSpider
class CrawlingSpider(CrawlSpider):
    '''
    create a new spider class
    '''
    name = 'my_first_spider'
    allowed_domains = ['toscrape.com']
    start_urls = ['http://books.toscrape.com/']
    
    rules = (
        Rule(LinkExtractor(allow='catalogue/category')),
        Rule(LinkExtractor(allow='catalogue',deny='category'), callback='parse_item'),
    )
    
    def parse_item(self,response):
        yield {
            "title": response.css('.product_main h1::text').get(),
            "price": response.css('.price_color::text').get(),
        }
```
定義完之後，就可以在 ```crawling/``` 資料夾下執行:
```bash
scrapy crawl my_first_spider -o output.json
```
```-o output.json``` 表示可以將爬取的結果 append 到 output.json 中，而如果是 ```-O output.json``` 則是 overwrite 原本的 output.json。  

如果要讓爬蟲可以中斷然後繼續執行:
```bash
scrapy crawl my_first_spider -s JOBDIR=crawling/spiders/my_first_spider -o output.json
```

在 ```settings.py``` 中可以設定爬取的速度、user-agent 等等，我額外的設定如下:
```python
BOT_NAME = "crawling"

SPIDER_MODULES = ["crawling.spiders"]
NEWSPIDER_MODULE = "crawling.spiders"

# Obey robots.txt rules
ROBOTSTXT_OBEY = False

# Configure maximum concurrent requests performed by Scrapy (default: 16)
CONCURRENT_REQUESTS = 32

# Disable cookies (enabled by default)
COOKIES_ENABLED = False

# Override the default request headers:
DEFAULT_REQUEST_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en",
}

USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

# Set settings whose default value is deprecated to a future-proof value
REQUEST_FINGERPRINTER_IMPLEMENTATION = "2.7"
TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"
FEED_EXPORT_ENCODING = "utf-8"
```

## Spiders
接下來要爬取台灣的網站，每個網站都有不同的格式和爬蟲策略，主要分成三種:
1. 文章網址最後是一串數字，如[關鍵評論網](https://www.thenewslens.com)，這樣就可以用 range 掃過他每篇文章
2. 文章網址沒有特別的規律，如 [TVBS](https://news.tvbs.com.tw)，這樣只能找出文章頁面的共同特徵 (如網址包含 article) 等等並利用 ```CrawlSpider``` 來爬取，有非常高機率只能爬到一小部分。
3. 該網頁內容非常少，可以完全寫死連結要抓哪個，如[台灣好行](https://www.taiwan.net.tw/m1.aspx?sNo=0001016)。

決定好爬蟲策略後，就可以開始寫爬蟲了，這邊以爬取 [東森](https://www.ettoday.net) 為例:  
```allowed_domains = ['ettoday.net']``` 表示只會爬取 ettoday 的網站  
```start_urls = ['https://www.ettoday.net/']``` 表示從 ettoday 的首頁開始爬取  
```rules``` 表示 爬取的規則，這邊是爬取所有網址包含 news 的網址，並且將其 follow 並且 callback 到 ```parse_items``` 函數中  
```parse_items``` 函數中會將網頁中的標題和文章內容抓取出來  

```title = response.xpath('//h1/text()').get()```的意思是抓第一個 h1 tag 的文字  
```article = ''.join(response.xpath('//div[contains(@class,"story")]/p/text()').getall())```的意思是抓所有 div tag 中 class 包含 story 的 p tag 的文字，然後將其合併成一個字串  
在 ```try``` 中將標題和文章內容做一些處理，如去除多餘的空白、換行等等  
```python
class ettodaycrawler(CrawlSpider):
    name = 'ettodaycrawler'
    allowed_domains = ['ettoday.net']
    start_urls = ['https://www.ettoday.net/']
    
    rules = (
        Rule(LinkExtractor(allow='news'), follow=True, callback='parse_items'),
    )
    
    def parse_items(self, response):
        title = response.xpath('//h1/text()').get()
        article = ''.join(response.xpath('//div[contains(@class,"story")]/p/text()').getall())
        
        try:
            title = ucd.normalize('NFKC', title.strip())
            article = ucd.normalize('NFKC', article.strip().replace('\r\n',''))
            article = re.sub(' +', ' ', article)
            article = re.sub(r'\n+', '\n', article)
            article = pangu.spacing(article)
        except Exception as e:
            print(e)
            return
        if title and len(article) > 100:
            yield {
                "source": "ETtoday",
                "title": title,
                "text": article,
                "url": response.url
            }
```
在爬蟲之前，可以先利用 scrapy shell 來測試爬取的規則是否正確:
```bash
scrapy shell https://star.ettoday.net/news/2897620
```

下面是各個網站的 spiders 還有對應的 token 數量:
| Source | URL | Size |
|--------|-----|------|
| 商業周刊 | [Link](https://www.businessweekly.com.tw) | 44M |
|  中天 | [Link](https://ctinews.com) | 159M |
| 關鍵評論網 | [Link](https://www.thenewslens.com) | 575M |
| 關鍵評論網英文版 | [Link](https://international.thenewslens.com) | 11M |
| 聯合報 | [Link](https://udn.com/news/index) | 323M |
| 台視 | [Link](https://news.ttv.com.tw) | 104M |
| 公視 | [Link](https://news.pts.org.tw) | 516M |
| yahoo | [Link](https://tw.news.yahoo.com) | 158M |
| 東森 | [Link](https://www.ettoday.net) | 5700M |
| 遠見 | [Link](https://www.gvm.com.tw/) | 228M |
| TVBS | [Link](https://news.tvbs.com.tw) | 63M |
| CASE 報科學 | [Link](https://case.ntu.edu.tw) | 11M |
| 地球圖輯隊 | [Link](https://dq.yam.com) | 33M |
| 泛科學 | [Link](https://pansci.asia) | 42M |
| 科學月刊 | [Link](https://www.scimonth.com.tw) | 9M |
| 科技大觀園 | [Link](https://scitechvista.nat.gov.tw) | 29M |
| Insider | [Link](https://www.inside.com.tw) | 41M |
| 科技新報 | [Link](https://technews.tw/) | 32M |
| 科技島 | [Link](https://www.technice.com.tw) | 142M |

有些網站 (如 TVBS 和 遠見雜誌) 需要爬慢一點否則會有 403 的問題，可以在爬蟲內定義:
```python
class CrawlingSpider(CrawlSpider):
    '''
    create a new spider class
    '''
    custom_settings = {
        'CONCURRENT_REQUESTS' : 32,
        'DOWNLOAD_DELAY' : 0.5
    }
    ...
```

## Postprocessing
爬取後的 json 檔會按照 news、science、tech 等等分類分別放在 ```data/news```、```data/science```、```data/tech``` 。然後要將這些資料轉成 parquet 格式，這樣可以更有效率的存取資料和上傳至 huggingface。
在 ```process/convert.py``` 中可以將 json 轉成 parquet 並存在 ```process/parquet``` 當中，並加上 label:
```python
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import os

def json_to_parquet(json_file, category):

    # Read JSON
    json_data_paths = [(os.path.join('../data', category, json)) for json in json_file]
    
    for json_data_path in json_data_paths:
        print("Processing", json_data_path)
        json_data = pd.read_json(json_data_path)
        # add a column named "label" to the batch
        json_data["category"] = [category] * len(json_data["title"])
        # sort columns
        json_data = json_data[['category', 'source', 'title', 'text', 'url']]
        # convert to dataframe
        df = pd.DataFrame(json_data)
        # Convert DataFrame to Arrow Table
        table = pa.Table.from_pandas(df)
        # Write Arrow Table to Parquet file
        pq.write_table(table, os.path.join('parquet', category, json_data_path.split('/')[-1].replace('.json', '.parquet')))

if __name__ == "__main__":
    json_to_parquet(json_file = os.listdir('../data/news'), category = 'news')
    json_to_parquet(json_file = os.listdir('../data/science'), category = 'science')
    json_to_parquet(json_file = os.listdir('../data/tech'), category = 'tech')
```

若有些 json 檔案太大，可以先將它分成很多 chunk 再轉成 parquet:
```python
import json
import os

def split_json_file(input_file, output_dir, num_of_chunks):
    # Read the JSON file
    with open(input_file, 'r') as f:
        data = json.load(f)
    
    # Calculate the number of records per chunk
    total_records = len(data)
    records_per_file = total_records // num_of_chunks
    if total_records % num_of_chunks != 0:
        records_per_file += 1
    
    # Split the data into chunks
    for i in range(0, len(data), records_per_file):
        chunk = data[i:i + records_per_file]
        output_file = os.path.join(output_dir, input_file.split('/')[-1].replace('.json','') + f'_chunk_{i // records_per_file + 1}.json')
        print(f'Creating {output_file}')
        # Write the chunk to a new JSON file
        with open(output_file, 'w') as f:
            json.dump(chunk, f, indent=4)
        
        print(f'Created {output_file} with {len(chunk)} records')

if __name__ == "__main__":
    input_file = '../data/news/ETtoday2.json'
    output_dir = '../data/news'
    num_of_chunks = 5
    
    split_json_file(input_file, output_dir, num_of_chunks)
```

## Upload to Huggingface
最後要將 parquet 上傳至 huggingface。
在 ```process/upload.py``` 中可以將剛剛所產生的 parquet 上傳至 huggingface:
```python
from datasets import Dataset
from datasets import load_dataset
import os

# Get the list of parquet files in the 'parquet' directory
parquet_files = [os.path.join('parquet/news', f) for f in os.listdir('parquet/news')]
parquet_files += [os.path.join('parquet/science', f) for f in os.listdir('parquet/science')]
parquet_files += [os.path.join('parquet/tech', f) for f in os.listdir('parquet/tech')]

# Load the dataset
dataset = load_dataset("parquet", data_files={'train': parquet_files})

dataset.push_to_hub("username/dataset", token=<TOKEN>)
```
最後可以在 huggingface 上下載這個 dataset 並使用:
```python
from datasets import load_dataset
dataset = load_dataset("benchang1110/Taiwan-pretrain-9B",split='train')
```