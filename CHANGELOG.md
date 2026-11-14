# 变更日志
## [2.1.7] - 2026-11-14 09:09
### 适配
- 适配 npm 12:该版本起不再把未知 CLI flag 透传为 `npm_config_*` 环境变量,而是直接报
  `EUNKNOWNCONFIG Unknown cli flag: --build-from-source`;`scripts/ios-build-native-modules.sh` 三处
  `npm rebuild --build-from-source` 改为环境变量 `npm_config_build_from_source="true"`,强制从源码编译的
  行为不变;npm 12 以下对本次改动无感;

## [2.1.6] - 2026-11-13 21:55
### 升级注意事项
- `engines.node` 由 `>=18` 收紧为 `>=22.12.0`,与作用域内其它包统一,并覆盖 `@flun/nodejs-mobile-gyp` 的真实下限;
  在 Node 18 / 20.0–20.8 上安装会直接失败;
- **该要求只约束开发机, 不约束移动端运行时**;移动端运行时由 `prebuiltAssets.version` 决定,仍可以是 Node.js 18;

### 文档
- README「支持的系统与配置要求」与「运行时版本与开发机的 Node 版本相互独立」两节补充上述区分,避免把
  `engines.node` 误解为"不能编译以 Node 18 为运行时的移动版本";

## [2.1.5] - 2026-11-11 11:05
### 优化
- 整体做了一些细节优化;