/**
 * postinstall：从 Gitee / GitHub Release 下载 android-libnode.zip 并替换 android/libnode/
 *
 * 读取 package.json 的 libnode 字段：
 *   {
 *     "version": "v18.20.4",
 *     "file": "android-libnode.zip",
 *     "sources": [
 *       "https://gitee.com/OpenFlun/nodejs-mobile/releases/download",
 *       "https://github.com/OpenFlun/nodejs-mobile/releases/download"
 *     ]
 *   }
 *
 * 环境变量：
 *   NODE_MOBILE_LIBNODE_VERSION  覆盖默认版本（如 v22.23.2）
 *   NODE_MOBILE_LIBNODE_SKIP=1   跳过下载（用于本地开发）
 *
 * 行为：
 *   - 已装版本 == 目标版本 → 跳过
 *   - 按 sources 顺序尝试下载，第一个成功即停
 *   - 全部失败 → 打印下载链接，但不中断 npm 安装
 *   - 只覆盖 android/libnode/，不动 ios/libnode/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const libnodeDir = path.join(packageRoot, 'android', 'libnode');
const versionFile = path.join(libnodeDir, '.flun-version');

const log = (...a) => console.log('  [libnode]', ...a);

// 跳过开关（本地开发用）
if (process.env.NODE_MOBILE_LIBNODE_SKIP === '1') {
  log('NODE_MOBILE_LIBNODE_SKIP=1，跳过');
  process.exit(0);
}

// 本地开发保护：在插件目录里直接 npm install 时跳过
if (process.env.INIT_CWD && path.resolve(process.env.INIT_CWD) === path.resolve(packageRoot)) {
  log('检测到本地开发场景，跳过');
  process.exit(0);
}

// 读 package.json 的 libnode 配置
const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf-8'));
const cfg = pkg.libnode;
if (!cfg) {
  log('package.json 未配置 libnode 字段，跳过');
  process.exit(0);
}

const targetVersion = process.env.NODE_MOBILE_LIBNODE_VERSION || cfg.version;
const fileName = cfg.file;
const sources = cfg.sources || [];

if (!targetVersion || !fileName || sources.length === 0) {
  log('libnode 字段配置不完整，跳过');
  process.exit(0);
}

// 幂等：已装版本匹配则跳过
if (fs.existsSync(versionFile)) {
  const installed = fs.readFileSync(versionFile, 'utf-8').trim();
  if (installed === targetVersion) {
    log(`已是最新版本 ${targetVersion}，跳过`);
    process.exit(0);
  }
}

// 按源顺序尝试下载
let buffer = null;
let lastError = null;

for (const base of sources) {
  const url = `${base}/${targetVersion}/${fileName}`;
  log(`尝试从 ${url} 下载...`);
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ab = await res.arrayBuffer();
    buffer = Buffer.from(ab);
    log(`下载成功（${(buffer.length / 1024 / 1024).toFixed(1)} MB）`);
    break;
  } catch (e) {
    lastError = e;
    console.warn(`  [libnode] 该源失败：${e.message}`);
  }
}

// 全部失败：打印链接，不中断安装
if (!buffer) {
  console.error('');
  console.error('  ⚠️  从所有源下载 libnode 均失败。');
  console.error('     请手动下载并覆盖到 android/libnode/：');
  for (const base of sources) {
    console.error(`       ${base}/${targetVersion}/${fileName}`);
  }
  if (lastError) console.error(`     最后错误：${lastError.message}`);
  console.error('');
  process.exit(0);
}

// 解压到临时目录
const tmpDir = path.join(packageRoot, '.libnode-tmp');
fs.rmSync(tmpDir, { recursive: true, force: true });
fs.mkdirSync(tmpDir, { recursive: true });

try {
  const zip = new AdmZip(buffer);
  zip.extractAllTo(tmpDir, true);
} catch (e) {
  console.error(`  [libnode] 解压失败：${e.message}`);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  process.exit(0);
}

// zip 内结构应为 libnode/ 开头
const extracted = path.join(tmpDir, 'libnode');
if (!fs.existsSync(extracted)) {
  console.error('  [libnode] 解压后未找到 libnode/ 目录，zip 结构异常');
  fs.rmSync(tmpDir, { recursive: true, force: true });
  process.exit(0);
}

// 覆盖 android/libnode/
fs.rmSync(libnodeDir, { recursive: true, force: true });
fs.cpSync(extracted, libnodeDir, { recursive: true });
fs.writeFileSync(versionFile, targetVersion + '\n');

// 清理临时目录
fs.rmSync(tmpDir, { recursive: true, force: true });

log(`已更新到 ${targetVersion}`);