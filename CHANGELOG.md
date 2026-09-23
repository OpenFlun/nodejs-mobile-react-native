# Changelog

## [1.0.1] - 2026-09-22 21:19

### 首发

- 发布 `@flun/nodejs-mobile-react-native`，基于 [nodejs-mobile-react-native](https://github.com/nodejs-mobile/nodejs-mobile-react-native) 18.20.4（flun fork）
- 为 React Native 应用提供完整的 Node.js。让 JS 服务端代码和 React Native 前端共享同一进程，双向通信。
- 可直接用于任何 React Native 项目，也可由 [`@flun/node-mobile-app`](https://www.npmjs.com/package/@flun/node-mobile-app) 在构建时自动调用。

### 代码风格

- 全量改造为 **ESM**（`package.json` 的 `type: "module"`）
- 导出方式统一为文件末尾 `export { ... }`
- 函数声明改为 `const xxx = (...) => {}`（`class` 保留）
- 注释全部中文化

### rn-bridge 处理

- `rn-bridge` 是 native binding 的 JS 包装，必须走 CJS（ESM 会崩溃：`pthread_mutex_lock called on a destroyed mutex` + SIGABRT）
- 文件改名为 `index.cjs`，`.cjs` 后缀强制 CJS，优先级高于包 `type`
- `package.json` 的 `main` 指向 `index.cjs`
- 效果：用户项目是 CJS 或 ESM，`import rn_bridge from 'rn-bridge'` 与 `require('rn-bridge')` 都能加载

### 依赖调整

- 依赖从 `nodejs-mobile-gyp` 换成 **`@flun/nodejs-mobile-gyp`**（升级 tar / glob / make-fetch-happen，消除 deprecated 警告）
- 删除 `xcode` 依赖（RN 0.60 autolinking 前的遗留，代码中零引用）
- `react-native` 的 peer 标为 **optional**（`peerDependenciesMeta`），避免本地安装拉下整棵 RN 依赖树

### 修复的上游问题

- **`create-node-structure.js` 依赖 `npm_package_name`**：`file:` / tgz 安装场景下 npm 不注入此环境变量，导致 `path.join(undefined, ...)` 报错。改为从 `__dirname` 反推包目录，并用 `INIT_CWD` 作为 fallback。
- **`android/build.gradle` gyp 路径**：适配 scoped 包 `@flun/nodejs-mobile-gyp`，保留对旧路径 `nodejs-mobile-gyp` 的兼容探测。
- **`ios-build-native-modules.sh` gyp 路径**：同上。

### 验证

- Android：Windows + `npx node-mobile-app test` / `build` 全流程通过，App 正常启动
- iOS：保留对 Node 18 的支持（未在 macOS 上实测）