/**
 * postinstall：从 Gitee / GitHub Release 下载预编译资源并替换到对应目录
 *
 * 读取 package.json 的 prebuiltAssets 字段：
 *   {
 *     "version": "v18.20.4",
 *     "sources": [
 *       "https://gitee.com/OpenFlun/nodejs-mobile/releases/download",
 *       "https://github.com/OpenFlun/nodejs-mobile/releases/download"
 *     ],
 *     "assets": [
 *       {
 *         "file": "android-libnode.zip",
 *         "entry": "libnode",
 *         "target": "android/libnode",
 *         "platforms": ["win32", "darwin", "linux"],
 *         "envKey": "ANDROID"
 *       },
 *       {
 *         "file": "ios-nodemobile.zip",
 *         "entry": "NodeMobile.xcframework",
 *         "target": "ios/NodeMobile.xcframework",
 *         "platforms": ["darwin"],
 *         "envKey": "IOS",
 *         "hintOn": "darwin",
 *         "hint": "..."
 *       }
 *     ]
 *   }
 *
 * 环境变量：
 *   NODE_MOBILE_PREBUILT_VERSION              覆盖默认版本（如 v22.23.2）
 *   NODE_MOBILE_PREBUILT_SKIP=1               跳过全部下载
 *   NODE_MOBILE_PREBUILT_<envKey>_SKIP=1      跳过指定 asset（如 _ANDROID_SKIP / _IOS_SKIP）
 *
 * 行为：
 *   - platforms 不匹配当前系统 → 跳过该 asset
 *   - 有 hintOn 匹配当前系统且未跳过 → 打印 hint
 *   - 每个 asset 独立处理，各自维护 .flun-version 标记
 *   - 已装版本 == 目标版本 → 跳过
 *   - 按 sources 顺序尝试下载，第一个成功即停
 *   - 单个 asset 全部源失败 → 打印下载链接，但不中断 npm 安装
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const tmpDir = path.join(packageRoot, '.prebuilt-tmp');
const log = (...a) => console.log('  [prebuilt]', ...a);

// 全局跳过
if (process.env.NODE_MOBILE_PREBUILT_SKIP === '1') {
  log('NODE_MOBILE_PREBUILT_SKIP=1，跳过');
  process.exit(0);
}

// 本地开发保护
if (process.env.INIT_CWD && path.resolve(process.env.INIT_CWD) === path.resolve(packageRoot)) {
  log('检测到本地开发场景，跳过');
  process.exit(0);
}

// 读 package.json
const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf-8'));
const cfg = pkg.prebuiltAssets;
if (!cfg) {
  log('package.json 未配置 prebuiltAssets 字段，跳过');
  process.exit(0);
}

const targetVersion = process.env.NODE_MOBILE_PREBUILT_VERSION || cfg.version;
const sources = cfg.sources || [];
const assets = cfg.assets || [];

if (!targetVersion || sources.length === 0 || assets.length === 0) {
  log('prebuiltAssets 字段配置不完整，跳过');
  process.exit(0);
}

for (const asset of assets) {
  await processAsset(asset);
}

async function processAsset(asset) {
  const { file, entry, target, platforms, envKey, hintOn, hint } = asset;
  if (!file || !entry || !target) {
    log('asset 配置不完整（缺少 file / entry / target），跳过');
    return;
  }

  const label = `[${target}]`;

  // 平台判断
  const supported = Array.isArray(platforms) && platforms.length > 0
    ? platforms.includes(process.platform)
    : true;
  if (!supported) {
    log(`${label} 当前系统（${process.platform}）不适用，跳过`);
    return;
  }

  // 单 asset 跳过开关
  if (envKey && process.env[`NODE_MOBILE_PREBUILT_${envKey}_SKIP`] === '1') {
    log(`${label} NODE_MOBILE_PREBUILT_${envKey}_SKIP=1，跳过`);
    return;
  }

  // 提示
  if (hint && hintOn === process.platform) {
    log(hint);
  }

  const targetDir = path.join(packageRoot, target);
  const versionFile = path.join(targetDir, '.flun-version');

  // 幂等
  if (fs.existsSync(versionFile)) {
    const installed = fs.readFileSync(versionFile, 'utf-8').trim();
    if (installed === targetVersion) {
      log(`${label} 已是最新版本 ${targetVersion}，跳过`);
      return;
    }
  }

  // 下载
  let buffer = null;
  let lastError = null;
  for (const base of sources) {
    const url = `${base}/${targetVersion}/${file}`;
    log(`${label} 尝试从 ${url} 下载...`);
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ab = await res.arrayBuffer();
      buffer = Buffer.from(ab);
      log(`${label} 下载成功（${(buffer.length / 1024 / 1024).toFixed(1)} MB）`);
      break;
    } catch (e) {
      lastError = e;
      console.warn(`  [prebuilt] ${label} 该源失败：${e.message}`);
    }
  }

  if (!buffer) {
    console.error('');
    console.error(`  ⚠️  ${label} 从所有源下载均失败。`);
    console.error(`     请手动下载并覆盖到 ${target}/：`);
    for (const base of sources) {
      console.error(`       ${base}/${targetVersion}/${file}`);
    }
    if (lastError) console.error(`     最后错误：${lastError.message}`);
    console.error('');
    return;
  }

  // 解压
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  try {
    new AdmZip(buffer).extractAllTo(tmpDir, true);
  } catch (e) {
    console.error(`  [prebuilt] ${label} 解压失败：${e.message}`);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return;
  }

  const extracted = path.join(tmpDir, entry);
  if (!fs.existsSync(extracted)) {
    console.error(`  [prebuilt] ${label} 解压后未找到 ${entry}/ 目录，zip 结构异常`);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return;
  }

  // 覆盖 target
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.cpSync(extracted, targetDir, { recursive: true });
  fs.writeFileSync(versionFile, targetVersion + '\n');

  fs.rmSync(tmpDir, { recursive: true, force: true });

  log(`${label} 已更新到 ${targetVersion}`);
}