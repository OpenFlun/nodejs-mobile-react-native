# 变更日志

## [2.2.1] - 2026-11-21 20:27
### 变更
- 本仓库地址中的用户名由 OpenFlun 改为 AtFlun,请注意!!!;

## [2.2.0] - 2026-11-20 10:28
### 功能更新
- 编译支持 node v24.19.0 并设置为默认;

***!!! 注意***: 1. Node.js 24 的官方头文件依赖 C++20 特性; 2. ios端还是v18.20.4;

## [2.1.7] - 2026-11-14 09:09
### 适配
- 适配 npm 12:该版本起不再把未知 CLI flag 透传为 `npm_config_*` 环境变量,而是直接报
  `EUNKNOWNCONFIG Unknown cli flag: --build-from-source`;`scripts/ios-build-native-modules.sh` 三处
  `npm rebuild --build-from-source` 改为环境变量 `npm_config_build_from_source="true"`,强制从源码编译的
  行为不变;npm 12 以下对本次改动无感;