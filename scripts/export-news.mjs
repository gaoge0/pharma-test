/**
 * 导出医药情报数据，用于 AI 分析
 *
 * 每次运行：
 *  1. 实时调用 worker 抓取 Google News RSS（绕过 GitHub Pages 每小时快照）
 *  2. 生成两个文件到 data/ 目录：
 *     - data/news-master.json  —— 去重后的主数据集（跨批次累积，JSON）
 *     - data/news-master.csv   —— 同一份数据，CSV 格式（方便 Excel/表格工具）
 *     - data/batches/news-<时间戳>.json —— 本次抓取的原始批次快照
 *
 * 用法：node scripts/export-news.mjs
 *       node scripts/export-news.mjs --csv-only   # 只生成 CSV，跳过主 JSON
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import worker from "../worker/index.js";

const dataDir = new URL("../data/", import.meta.url);
const batchDir = new URL("../data/batches/", import.meta.url);
const masterFile = new URL("../data/news-master.json", import.meta.url);
const csvFile = new URL("../data/news-master.csv", import.meta.url);

const now = new Date();
const batchStamp = now.toISOString().replace(/[:.]/g, "-");

// 1. 实时抓取最新数据（本地运行，无缓存）
const response = await worker.fetch(new Request("https://localhost/api/news"));
if (!response.ok) throw new Error(`抓取失败: HTTP ${response.status}`);

const data = await response.json();
const collectedAt = new Date().toISOString();

// 1b. 全部抓取失败时的安全保护：不覆盖已有数据，直接退出
if (data.items.length === 0) {
  console.error("⚠ 本次抓取 0 条（可能是网络无法访问 Google News）。已有数据集保持不变。");
  console.error("   提示：在中国大陆环境无法直连 Google News，请改用 GitHub Actions 采集（见 README）。");
  process.exit(1);
}

// 2. 标注每条数据的采集时间
const batch = data.items.map((item) => ({ ...item, collectedAt }));

// 3. 读取历史主数据集（如果存在）
let master = { lastUpdated: collectedAt, count: 0, items: [] };
try {
  master = JSON.parse(await readFile(masterFile, "utf8"));
} catch {
  /* 首次运行，尚无历史数据 */
}

// 4. 按 link 去重合并（同一篇文章链接相同；用链接比用标题更可靠）
const seen = new Set(master.items.map((item) => item.link));
const fresh = batch.filter((item) => {
  if (!item.link || seen.has(item.link)) return false;
  seen.add(item.link);
  return true;
});
master.items = [...fresh, ...master.items]; // 新的放前面
master.lastUpdated = collectedAt;
master.count = master.items.length;

// 5. 写主数据集
await mkdir(dataDir, { recursive: true });
await mkdir(batchDir, { recursive: true });
await writeFile(masterFile, JSON.stringify(master, null, 2), "utf8");
await writeFile(new URL(batchStamp + ".json", batchDir), JSON.stringify(batch, null, 2), "utf8");

// 6. 生成 CSV（字段含逗号/引号时做转义）
const escapeCsv = (value = "") => {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const header = ["collectedAt", "pubDate", "category", "categoryLabel", "title", "source", "link", "summary"];
const rows = master.items.map((item) =>
  header.map((field) => escapeCsv(item[field])).join(","),
);
const csv = [header.join(","), ...rows].join("\n");
await writeFile(csvFile, csv, "utf8");

// 7. 汇总输出
const byCategory = {};
for (const item of master.items) {
  byCategory[item.categoryLabel] = (byCategory[item.categoryLabel] || 0) + 1;
}
const failedMsg = data.failed?.length ? `（${data.failed.length} 个源抓取失败: ${data.failed.join(", ")}）` : "";

console.log(`✔ 本次抓到 ${batch.length} 条，新增 ${fresh.length} 条${failedMsg}`);
console.log(`✔ 主数据集共 ${master.count} 条（跨批次去重后）`);
console.log(`✔ 已写入:`);
console.log(`   data/news-master.json  (${Math.round(masterFile.toString().length)} 字符)`);
console.log(`   data/news-master.csv   (${csv.length} 字符)`);
console.log(`   data/batches/${batchStamp}.json`);
console.log(`\n按分类统计（当前全部数据）:`);
for (const [label, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
  console.log(`   ${label.padEnd(14)} ${count}`);
}
