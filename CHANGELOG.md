# 变更日志

## [2.0.0] - 2026-09-25 21:15

### 破坏性变更

- **Node.js 运行时升级：v18.20.4 -> v22.23.2**，Android / iOS 的 `prebuiltAssets.version` 同步更新
  - Android：v22.23.2 内置完整 ICU（full-icu），支持 `\p{...}` 等 Unicode 属性转义
  - iOS：暂未适配 full-icu，后续跟进

### 修复

- **CJS loader 补丁按目录定位 rn-bridge**：早期 v22 产物内置的 CJS loader 补丁按 `rn-bridge/index.js` 硬编码定位入口，与本包在 `type: module` 下已改名为 `index.cjs` 的入口不匹配，导致 App 启动即闪退（`FORTIFY: pthread_mutex_lock called on a destroyed mutex` + `SIGABRT`）。适配包的 CJS loader 补丁改为按目录 `rn-bridge` 定位，入口文件名交给该目录 `package.json` 的 `main` 字段解析，`index.js` / `index.cjs` / `index.mjs` 均可正确加载。

### 文档

- **`metro.config.js` 排除配置**：
  - `blacklistRE` -> `blockList`（Metro 0.61 起重命名，0.86+ 已移除旧名）
  - 导入路径 `metro-config/src/defaults/exclusionList.js` -> `metro-config/private/defaults/exclusionList`（Metro 0.83 起 `src/*` 不再暴露；不带 `.js` 后缀，需经 `.default` 取值）
  - 正则改为 `/[/\\]nodejs-assets[/\\].*/` 形式（原来依赖字符串转义，跨平台易出错）
- **`main.js` 示例**：统一为 `createRequire(import.meta.url)` 写法，避免 `type: module` 下直接 `require` 报错
- **安装命令**：去掉 `-D`（本包在直接使用场景下为运行时依赖；仅通过 `@flun/node-mobile-app` 间接使用时才可作开发依赖）
- **`allowScripts` 字段说明**：npm 11.16+ 引入，npm 12 默认强制执行；旧版本忽略，新版本缺失则依赖的安装脚本不执行
- **Channel 回调边界**：补充 `null` 可序列化、`NaN` / `Infinity` / `-Infinity` 转 `null`、`undefined` 在对象中剔除 / 数组中转 `null`、循环引用抛 `TypeError`
- 全文标点、空格、措辞规范化；「共享同一进程」改为「同一进程的不同线程」；「互不影响」改为「彼此独立」

---

## [1.0.3] - 2026-09-23 19:11

### 修复

- **`create-node-structure.js` 的 ESM 加载错误**：Node ESM 加载 CJS 包（`mkdirp`、`ncp`）时，部分环境下不提供 default 导出，导致安装即报 `The requested module 'mkdirp' does not provide an export named 'default'`。改用 `createRequire(import.meta.url)` 走 CJS 加载路径，兼容所有 Node 版本。

---

## [1.0.1] - 2026-09-23 12:02

### 首发

- 发布 `@flun/nodejs-mobile-react-native`,基于 [nodejs-mobile-react-native](https://github.com/nodejs-mobile/nodejs-mobile-react-native) 18.20.4（flun fork）
- 为 React Native 应用提供完整的 Node.js;让 JS 服务端代码和 React Native 前端共享同一进程,双向通信;
- 可直接用于任何 React Native 项目,也可由 [`@flun/node-mobile-app`](https://www.npmjs.com/package/@flun/node-mobile-app) 在构建时自动调用;

### 代码风格

- 全量改造为 **ESM**（`package.json` 的 `type: "module"`）
- 导出方式统一为文件末尾 `export { ... }`
- 函数声明改为 `const xxx = (...) => {}`（`class` 保留）
- 注释全部中文化

### rn-bridge 处理

- `rn-bridge` 是 native binding 的 JS 包装,必须走 CJS（ESM 会崩溃：`pthread_mutex_lock called on a destroyed mutex` + SIGABRT）
- 文件改名为 `index.cjs`,`.cjs` 后缀强制 CJS,优先级高于包 `type`
- `package.json` 的 `main` 指向 `index.cjs`
- 效果：用户项目是 CJS 或 ESM,`import rn_bridge from 'rn-bridge'` 与 `require('rn-bridge')` 都能加载

### 预编译资源分发（新增机制）

**背景**：`libnode.so`（Android,约 187 MB）与 `NodeMobile.xcframework`（iOS,约 162 MB）体积太大,直接进 git 会超出托管平台的文件上限（GitHub 单文件 100 MB 硬限制、Gitee 免费版 网页50 命令行200 MB）,直接进 npm 会让用户装包时被迫下载 107 MB

**方案**：两套预编译二进制从 git 与 npm 包中移除,改为 postinstall 阶段按需下载;

- **新增脚本**：`scripts/download-prebuilt-assets.js`
- **新增 `package.json` 字段**：`prebuiltAssets`
  - `version`：目标版本（如 `v18.20.4`）
  - `sources`：下载源列表,按顺序尝试（Gitee → GitHub）
  - `assets`：资源清单,每个 asset 含 `file` / `entry` / `target` / `platforms` / `envKey` / `hint`
- **下载后行为**：解压并覆盖 `android/libnode/` 与 `ios/NodeMobile.xcframework/`,各自写 `.flun-version` 标记,版本匹配则跳过
- **平台判断**：
  - Windows / Linux：只下 Android
  - macOS：会打印提示,由用户决定是否一并下 iOS
- **失败处理**：所有源都失败时打印下载链接,**不中断 npm 安装**,用户可手动下载覆盖

**环境变量**：

| 变量                                  | 作用                          |
| ------------------------------------- | ----------------------------- |
| `NODE_MOBILE_PREBUILT_VERSION`        | 覆盖默认版本（如 `v22.23.2`） |
| `NODE_MOBILE_PREBUILT_SKIP=1`         | 跳过全部下载                  |
| `NODE_MOBILE_PREBUILT_ANDROID_SKIP=1` | 只跳过 Android                |
| `NODE_MOBILE_PREBUILT_IOS_SKIP=1`     | 只跳过 iOS                    |

**npm 包体积**：tarball 从 107 MB 降到 **1.2 MB**,用户装包时秒装,之后 postinstall 拉二进制;

### 依赖调整

- 依赖从 `nodejs-mobile-gyp` 换成 **`@flun/nodejs-mobile-gyp`**（升级 tar / glob / make-fetch-happen,消除 deprecated 警告）
- 删除 `xcode` 依赖（RN 0.60 autolinking 前的遗留,代码中零引用）
- `react-native` 的 peer 标为 **optional**（`peerDependenciesMeta`）,避免本地安装拉下整棵 RN 依赖树
- 新增 `adm-zip`（postinstall 解压预编译资源用）

### 修复的上游问题

- **`create-node-structure.js` 依赖 `npm_package_name`**：`file:` / tgz 安装场景下 npm 不注入此环境变量,导致 `path.join(undefined, ...)` 报错;改为从 `__dirname` 反推包目录,并用 `INIT_CWD` 作为 fallback;
- **`android/build.gradle` gyp 路径**：适配 scoped 包 `@flun/nodejs-mobile-gyp`,保留对旧路径 `nodejs-mobile-gyp` 的兼容探测;
- **`ios-build-native-modules.sh` gyp 路径**：同上;
- **`create-node-structure.js` 跳过逻辑**：宿主项目若依赖 `@flun/node-mobile-app`,本包不再执行 nodejs-assets 复制——node-mobile-app 有自己的模板拷贝逻辑,重复执行只会让用户困惑;
- **`index.js` 用户可见错误信息中文化**：`start` / `startWithArgs` 参数校验、`Channel not found` 报错改为中文;

### 验证

- Android：Windows + `npx node-mobile-app test` / `build` 全流程通过,App 正常启动;
- 预编译资源下载：Gitee / GitHub 双源均可达,重复执行脚本会跳过已装版本；模拟 macOS 时 iOS 附件正确下载并覆盖;
- npm 打包：tarball 1.2 MB,无 `android/libnode/bin`、无 `ios/NodeMobile.xcframework`;
- iOS：保留对 Node 18 的支持（未在 macOS 上实测）;