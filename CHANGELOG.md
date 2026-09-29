# 变更日志
## [2.0.7] - 2026-09-29 19:49
### 优化
- 优化了一些处理细节;

## [2.0.6] - 2026-09-28 22:00
### 修复

- **子进程找不到 npm.cmd**：`BuildNpmModules` 任务里，部分依赖（如 `node` 包）的安装脚本会通过 shell 再调 `npm.cmd`，依赖 PATH 查找。原先任务构造的 PATH 只含 NDK 目录、用户项目 `.bin` 与系统 PATH，不含 Node 安装目录，导致 `'npm.cmd' is not recognized`。现把 `node.exe` 所在目录加入 PATH。

## [2.0.5] - 2026-09-28

### 修复

- **`create-node-structure.js` 跳过逻辑失效，`nodejs-assets` 在应跳过时仍被生成**：两处原因叠加。
  - **宿主包目录推断错误**：`hostPackageDir` 原先用 `lastIndexOf('node_modules')`。包被 hoist 到项目根 `node_modules` 时能正确落到用户项目根；但包被嵌套安装到 `@flun/node-mobile-app/node_modules/` 下时，`lastIndexOf` 会命中更深的那个 `node_modules`，得到的路径是 `@flun/node-mobile-app` 自身，其 `package.json` 不含 `@flun/node-mobile-app` 依赖，判断不命中。现改为 `indexOf('node_modules')` 取第一个 `node_modules`，hoist 与嵌套两种情况都落到真正的宿主项目根。
  - **`npm i -D` 时 pkg.json 尚未写入**：`npm i -D @flun/node-mobile-app` 会在 postinstall 跑完之后才把新依赖写进 `package.json`，此时读宿主 `package.json` 无论如何都看不到 `@flun/node-mobile-app`，跳过逻辑必然失效（此前用 `npm i` 重装能跳过，就是因为依赖已在 pkg.json 里）。现除读 `package.json` 外，同时检查宿主项目 `node_modules/@flun/node-mobile-app` 是否存在，覆盖安装时序问题。