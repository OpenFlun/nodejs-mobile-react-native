# 变更日志
## [2.1.1] - 2026-10-25 10:11

### 优化
- 项目标点已改为以英文标点为主;
- 行宽改为以 123 为主,部分超宽表格改为了列表;

## [2.1.0] - 2026-10-20 14:39

### 新增
- **配合 `@flun/node-mobile-app` 的编译前移**:`@flun/node-mobile-app` 在 `nodejs-assets/` 下写入标记文件
  `.native-built-<abi>` 后,本包的三个 Gradle 任务按标记调整行为;
  - `DeleteIncorrectPrebuilds`:标记存在时保留 `build/Release/*.node`,避免删除前移阶段已编译的产物;
  - `DetectCorrectPrebuilds`:标记存在且该包已有 `build/Release/*.node` 时,跳过 prebuild 替换,
    避免用预编译产物覆盖已编译结果;
  - `BuildNpmModules`:标记存在时跳过,避免重复编译;

### 升级注意事项
- **单独安装本包时行为不变**:标记文件不存在时,三个任务按原逻辑执行--`DeleteIncorrectPrebuilds` 删除所有非 Android prebuild
  的 `.node`,`DetectCorrectPrebuilds` 用 prebuild 替换 `build/Release`,`BuildNpmModules` 正常编译;该标记仅由
  `@flun/node-mobile-app` 写入;

## [2.0.8] - 2026-10-13 15:20
### 优化
- 优化了一些处理细节;