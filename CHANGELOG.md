# 变更日志
## [2.1.0] - 2026-10-20 14:39

### 新增
- **配合 `@flun/node-mobile-app` 的编译前移**:`@flun/node-mobile-app` 在 `nodejs-assets/` 下写入标记文件 `.native-built-<abi>` 后,本包的三个 Gradle 任务按标记调整行为;
  - `DeleteIncorrectPrebuilds`:标记存在时保留 `build/Release/*.node`,避免删除前移阶段已编译的产物;
  - `DetectCorrectPrebuilds`:标记存在且该包已有 `build/Release/*.node` 时,跳过 prebuild 替换,避免用预编译产物覆盖已编译结果;
  - `BuildNpmModules`:标记存在时跳过,避免重复编译;

### 升级注意事项
- **单独安装本包时行为不变**:标记文件不存在时,三个任务按原逻辑执行--`DeleteIncorrectPrebuilds` 删除所有非 Android prebuild 的 `.node`,`DetectCorrectPrebuilds` 用 prebuild 替换 `build/Release`,`BuildNpmModules` 正常编译;该标记仅由 `@flun/node-mobile-app` 写入;

## [2.0.8] - 2026-10-13 15:20
### 优化
- 优化了一些处理细节;

## [2.0.7] - 2026-09-29 19:49
### 优化
- 优化了一些处理细节;

## [2.0.6] - 2026-09-28 22:00
### 修复

- **子进程找不到 npm.cmd**:`BuildNpmModules` 任务里,部分依赖(如 `node` 包)的安装脚本会通过 shell 再调 `npm.cmd`,依赖 PATH 查找.原先任务构造的 PATH 只含 NDK 目录,用户项目 `.bin` 与系统 PATH,不含 Node 安装目录,导致 `'npm.cmd' is not recognized`.现把 `node.exe` 所在目录加入 PATH.
