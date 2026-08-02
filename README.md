# Pharma Monitor

全球医药与生物科技行业情报监测网站，自动更新行业、监管、临床、交易与制造动态。

首页包含“中国公开数据与销售线索”模块，聚合：

- 国家药监局、CDE、国家医保局及政府公开信息
- 巨潮资讯、上交所和港交所的医药上市公司公告与年报线索
- 公开发布的市场规模、医院终端和零售销售研究
- 微信公众号中的医药、生物科技与政策文章线索

公开销售数据仅用于发现研究线索，并保留来源与统计口径；不等同于付费数据库的完整终端销量。

## 数据采集（用于 AI 分析）

情报数据来自 Google News RSS。由于中国大陆无法直连 Google News，推荐通过 GitHub Actions 在 GitHub 服务器上采集：

1. **自动采集**：`.github/workflows/collect-data.yml` 每天 4 次在 GitHub 服务器上运行 `node scripts/export-news.mjs`，把去重后的累积数据集提交回仓库的 `data/` 目录。
2. **下载数据**：仓库里 `data/news-master.json`（完整 JSON）和 `data/news-master.csv`（表格格式），或在 Actions 页面手动触发「采集医药情报数据」立即刷新。

本地直接运行 `node scripts/export-news.mjs` 需要能访问 Google News（中国大陆需代理）。
