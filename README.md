# @flun/nodejs-mobile-react-native

为 React Native 应用提供完整的 Node.js;让 JS 服务端代码和 React Native 前端共享同一进程,双向通信;

基于 [nodejs-mobile-react-native](https://github.com/nodejs-mobile/nodejs-mobile-react-native) 18.20.4 的 flun fork;

可直接用于任何 React Native 项目,也可由 [`@flun/node-mobile-app`](https://www.npmjs.com/package/@flun/node-mobile-app) 在构建时自动调用;

- GitHub：https://github.com/OpenFlun/nodejs-mobile-react-native
- Gitee：https://gitee.com/OpenFlun/nodejs-mobile-react-native
- npm：https://www.npmjs.com/package/@flun/nodejs-mobile-react-native
---

## 配置

### 允许安装脚本执行

本包在安装时可能触发某些依赖包的自动脚本（如 `postinstall` 等）;如果你的 npm 全局配置或项目配置禁止了脚本执行（例如设置了 `ignore-scripts=true`）,可能会导致安装不完整或运行时异常;

推荐在项目根目录的 `package.json` 中添加 `allowScripts` 字段,显式放行本包及其依赖的脚本:

```json
{
  "allowScripts": {
    "@flun/nodejs-mobile-react-native": true
    // 如果依赖的其它包（如 bcrypt、electron-winstaller 等）也有脚本,请按需添加,格式相同
  }
}
```

> 如果你信任所有安装包,也可以直接在项目 `.npmrc` 中设置 `allow-scripts = false`（表示关闭脚本拦截,所有脚本均允许执行）,或删除 `ignore-script`字段;

---
## 安装

```bash
npm i @flun/nodejs-mobile-react-native
```

iOS 需额外运行 `pod install` 链接原生代码：

```bash
cd ios && pod install
```

如果你的依赖是 `@flun/node-mobile-app`],那么你不需要手动安装本包,它由 CLI 在构建时自动调用;

### 首次安装的预编译资源下载

本包的 npm tarball 只有 **1.2 MB**（仅代码）,不含预编译二进制;安装后 postinstall 会自动从 Gitee / GitHub Release 拉取：

- **Android**：`android-libnode.zip`（v18约 52 MB）→ 覆盖到 `android/libnode/`
- **iOS**（仅 macOS）：`ios-nodemobile.zip`（v18约 47 MB）→ 覆盖到 `ios/NodeMobile.xcframework/`

细节见下方「本 fork 的改动 → 预编译资源下载」;

环境变量（按需设置）：

```bash
# 覆盖默认版本（如 v22.23.2）
NODE_MOBILE_PREBUILT_VERSION=v22.23.2

# 跳过全部下载
NODE_MOBILE_PREBUILT_SKIP=1

# 只跳过 iOS（macOS 上只做 Android 编译时用）
NODE_MOBILE_PREBUILT_IOS_SKIP=1
```

## 项目结构

```txt
@flun/nodejs-mobile-react-native/
│
├── index.js                      # JS 桥接层：start / startWithArgs / startWithScript / channel,通过 NativeModules 与原生通信
├── index.d.ts                    # TypeScript 类型声明
├── react-native.config.js        # RN CLI 配置：指定 Android sourceDir 与 iOS 的 4 个 Script Phase
├── nodejs-mobile-react-native.podspec  # iOS Pod 配置（vendored NodeMobile.xcframework）
├── package.json                  # type: module,postinstall 触发 scripts/create-node-structure.js
├── CHANGELOG.md                  # 版本变更记录
├── LICENSE
├── README.md                     # 本文件
├── .gitignore / .npmignore / .gitattributes
│
├── android/                      # Android 原生工程
│   ├── build.gradle              # 含 gyp 路径探测（@flun/nodejs-mobile-gyp）与 abiFilters patch 入口
│   ├── CMakeLists.txt            # 编译 rn-bridge.cpp + native-lib.cpp
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── cpp/
│       │   ├── native-lib.cpp    # JNI 入口,设置 NODE_PATH、启动 Node 引擎、stdout/stderr 重定向
│       │   ├── rn-bridge.cpp     # 注册 native binding（NODE_MODULE_LINKED）与 channel 队列
│       │   └── rn-bridge.h
│       └── java/com/janeasystems/rn_nodejs_mobile/
│           ├── RNNodeJsMobileModule.java  # RN 原生模块：start / sendMessage / registerChannel 等
│           └── RNNodeJsMobilePackage.java
│
├── ios/                          # iOS 原生工程
│   ├── NodeRunner.hpp            # Node 引擎生命周期管理
│   ├── NodeRunner.mm             # 设置 NODE_PATH、启动 Node、stdout/stderr 回调
│   ├── rn-bridge.cpp             # iOS 端同名 native binding
│   ├── rn-bridge.h
│   ├── RNNodeJsMobile.h
│   ├── RNNodeJsMobile.m          # RN 原生模块；-r 加载 dlopen override
│   ├── RNNodeJsMobile.xcodeproj/
│   ├── RNNodeJsMobile.xcworkspace/
│   ├── libnode/include/node/     # 官方 v18 头文件（随 npm 包分发）
│   └── NodeMobile.xcframework/   # iOS 静态库；由 postinstall 下载（见下方"预编译资源"）
│
├── install/                      # postinstall 复制到宿主项目的运行时资源
│   └── resources/
│       ├── nodejs-assets/nodejs-project/
│       │   ├── sample-main.js       # 用户 main.js 示例（ESM）
│       │   └── sample-package.json  # 用户 package.json 示例（含 type: module）
│       └── nodejs-modules/builtin_modules/rn-bridge/
│           ├── index.cjs            # rn-bridge 运行时模块（CJS,.cjs 强制后缀以兼容 ESM 项目）
│           └── package.json         # main: index.cjs
│
├── scripts/                      # 构建与安装期脚本（全部 ESM）
│   ├── create-node-structure.js     # postinstall：复制 nodejs-assets 到宿主项目根；宿主项目依赖 @flun/node-mobile-app 时跳过
│   ├── download-prebuilt-assets.js  # postinstall：从 Gitee / GitHub Release 下载 libnode.so / NodeMobile.xcframework
│   ├── patch-package.js             # 补丁原生模块的 package.json（node-gyp-build → node-gyp-build-mobile）
│   ├── ios-copy-nodejs-project.sh   # iOS Script Phase：复制 Node 项目
│   ├── ios-build-native-modules.sh  # iOS Script Phase：调用 @flun/nodejs-mobile-gyp 编译原生模块
│   ├── ios-sign-native-modules.sh   # iOS Script Phase：签名原生模块
│   ├── ios-remove-framework-simulator-strips.sh  # iOS Script Phase：移除模拟器切片
│   ├── ios-create-plists-and-dlopen-override.js  # 生成 framework Info.plist 与 dlopen 覆盖数据
│   ├── override-dlopen-paths-preload.js          # 运行时 preload,覆盖 process.dlopen 指向 App 内 Frameworks
│   └── plisttemplate.xml
│
└──  维护.md                       # 维护笔记（仅本地开发,不随包发布）
```

## 本 fork 的改动

本 fork 在功能上与原版 `nodejs-mobile-react-native` 一致,做了以下改造;

### 代码风格

| 项                  | 原版                                 | 本 fork                                             |
| ------------------- | ------------------------------------ | --------------------------------------------------- |
| 模块系统            | CommonJS                             | **ESM**（`package.json` 的 `type: "module"`）       |
| 导出方式            | 文件内 `module.exports`              | 文件末尾统一 `export { ... }`                       |
| 函数声明            | `function xxx`                       | `const xxx = (...) => {}`（`class` 保留）           |
| 注释                | 英文                                 | 中文                                                |
| 依赖                | `nodejs-mobile-gyp`                  | **`@flun/nodejs-mobile-gyp`**（去停更依赖）         |
| `xcode` 依赖        | 保留（RN 0.60 autolinking 前的遗留） | **删除**（代码中零引用）                            |
| `react-native` peer | 强制                                 | **`peerDependenciesMeta.optional`**（避免重复安装） |

### rn-bridge 的处理

`rn-bridge` 是 native binding 的 JS 包装,通过 `process._linkedBinding('rn_bridge')` 拿到 native 模块;

**它是边界模块（native ↔ JS）,必须走 CJS;** 但它所在的包是 `type: module`,所以：

- 文件改名为 `index.cjs`（.cjs 后缀强制 CJS,优先级高于包 type）
- `package.json` 的 `main` 指向 `index.cjs`
- 效果：无论用户项目是 CJS 还是 ESM,`import rn_bridge from 'rn-bridge'`（ESM）或 `require('rn-bridge')`（CJS）都能加载

### 修复的上游问题

- **`create-node-structure.js` 依赖 `npm_package_name`**：在 `file:` / tgz 安装场景下 npm 不注入此环境变量,导致 `path.join(undefined, ...)` 报错;改为从 `__dirname` 反推包目录,并用 `INIT_CWD` 作为 fallback;
- **`android/build.gradle` gyp 路径**：适配 scoped 包 `@flun/nodejs-mobile-gyp`,保留对旧路径 `nodejs-mobile-gyp` 的兼容探测;
- **`ios-build-native-modules.sh` gyp 路径**：同上;

### 预编译资源下载（libnode.so / NodeMobile.xcframework）

两套预编译二进制体积较大,不适合塞进 git 与 npm 包：

| 资源                  | 大小     | 用途                            |
| --------------------- | -------- | ------------------------------- |
| `android-libnode.zip` | 约 52 MB | Android 三个架构的 `libnode.so` |
| `ios-nodemobile.zip`  | 约 47 MB | iOS 的 `NodeMobile.xcframework` |

本 fork 把它们从 git 与 npm 包中移除,改为 **postinstall 阶段自动下载**：

- 脚本：`scripts/download-prebuilt-assets.js`
- 配置：`package.json` 的 `prebuiltAssets` 字段（版本号、下载源、asset 列表）
- 下载源：Gitee Release → 失败时回退 GitHub Release
- 下载后自动解压并覆盖 `android/libnode/` 与 `ios/NodeMobile.xcframework/`
- 各 asset 独立处理,已装版本匹配则跳过（不重复下载）
- 按平台判断：Windows / Linux 只下 Android；macOS 会提示是否连 iOS 一起下

**环境变量**：

| 变量                                  | 作用                          |
| ------------------------------------- | ----------------------------- |
| `NODE_MOBILE_PREBUILT_VERSION`        | 覆盖默认版本（如 `v22.23.2`） |
| `NODE_MOBILE_PREBUILT_SKIP=1`         | 跳过全部下载                  |
| `NODE_MOBILE_PREBUILT_ANDROID_SKIP=1` | 只跳过 Android                |
| `NODE_MOBILE_PREBUILT_IOS_SKIP=1`     | 只跳过 iOS                    |

**全部下载失败时**：脚本打印 Gitee / GitHub 下载链接,用户手动下载后覆盖到对应目录即可,**不会中断 npm 安装**;

**npm 包体积**：tarball 从 107 MB 降到 1.2 MB,用户装包时秒装,之后 postinstall 拉二进制;

### 踩坑记录

以下记录改造过程中真实遇到的问题,供维护与排查参考;

#### 1. rn-bridge 改成 ESM 会崩溃

把 `rn-bridge/index.js` 从 CJS 改写为 ESM 后,App 启动即闪退,logcat 显示：

```
FORTIFY: pthread_mutex_lock called on a destroyed mutex
Fatal signal 6 (SIGABRT), code -1 (SI_QUEUE)
```

原因：`rn-bridge` 通过 `process._linkedBinding('rn_bridge')` 拿 native binding;native 侧期望的导出契约是 CJS 的 `module.exports`,ESM 的 default 导出在语义和时序上都不匹配（Node 会在 ESM 模块的链接期与求值期之间做特定处理,native binding 拿不到已注册的 channel,访问了已销毁的 mutex）;

**结论**：rn-bridge 必须走 CJS;

#### 2. 为什么用 `.cjs` 而不是 `.js`

本包整体是 `type: module`,普通的 `.js` 会被按 ESM 解析;`.cjs` 后缀是 Node 官方约定的 CommonJS 强制后缀,**优先级高于包 `type`**——无论引用方是 CJS 还是 ESM 项目,Node 都用 CJS loader 加载 `index.cjs`;

因此：

- `import rn_bridge from 'rn-bridge'`（ESM）→ default 即 `module.exports`
- `require('rn-bridge')`（CJS）→ 原生

两种写法都能拿到 `{ app, channel }`;

#### 3. `sample-main.js` 与生成的 `main.js` 为什么模块类型不同

- `sample-main.js`（示例,给用户参考）：用 ESM `import`;用户整包复制后,`sample-package.json` 自带 `type: module`,`import` 天然成立;
- `main.js`（CLI 生成）：由 `@flun/node-mobile-app` 的 `generate.js` 生成,用 `require('rn-bridge')`;原因见坑 1——rn-bridge 的加载必须走 CJS loader 路径;

两者并存,各服务各的场景;

#### 4. 本地测试：`file:` 依赖 + junction 的坑

本地开发阶段,三个包之间互相用 `file:` 路径引用（见下方"关于 `file:` 依赖"）;npm 对 `file:` 依赖的默认安装方式是**创建 junction 指向源目录**;

Metro 默认**不跟随 junction**,导致 `Unable to resolve module @flun/nodejs-mobile-react-native`;

**规避**：装完后把 junction 替换为实体拷贝：

```powershell
Remove-Item -Recurse -Force node_modules\@flun\nodejs-mobile-react-native
robocopy <你的-fork-目录> <你的测试项目>\node_modules\@flun\nodejs-mobile-react-native /E /XD node_modules .git .github
```

#### 5. 本地测试：`file:` 依赖不提升,gyp 会嵌套

`file:` 依赖没有版本号,npm 无法用 semver 判断能否提升到顶层,会**就地安装**;于是 `@flun/nodejs-mobile-gyp` 被装到：

```
node_modules/@flun/nodejs-mobile-react-native/node_modules/@flun/nodejs-mobile-gyp
```

而不是顶层的 `node_modules/@flun/nodejs-mobile-gyp`;

#### 6. 本地测试：robocopy `/XD node_modules` 会漏掉 gyp

上面第 4 步的 robocopy 用 `/XD node_modules` 排除子目录依赖,会把 gyp 也一并漏掉;表现为：

```
Error: Cannot find package 'nopt' imported from .../@flun/nodejs-mobile-gyp/lib/node-gyp.js
```

**规避**：手工把 gyp 拷进 fork 的 `node_modules/@flun/` 下,并在 gyp 目录里跑 `npm install --omit=dev` 补依赖;

#### 7. `peerDependenciesMeta.react-native` 为什么标 optional

原版把 `react-native` 声明为强制 peer,npm 7+ 会自动安装 peer,导致 fork 目录本地 `npm install` 时拉下整棵 137 MB 的 RN 依赖树（metro、babel 等）;

实际使用中,`react-native` 由 `@flun/node-mobile-app` 的 `dependencies` 提供,不会缺失;标 optional 后：

- fork 目录本地安装从 811 个包降到 5 个
- 用户项目里 `react-native` 依然由 `node-mobile-app` 带进来

#### 8. 构建产物不要提交

`android/.cxx`、`android/build`、`android/app/build` 是本地 Gradle/CMake 构建产物,发布前必须删;

### 关于 `file:` 依赖（仅本地开发）

本仓库与 `@flun/nodejs-mobile-gyp` 之间用 `file:` 路径引用,**这是本地开发/联调阶段的临时方式**：

```json
"@flun/nodejs-mobile-gyp": "file:../nodejs-mobile-gyp"
```

**发布到 npm 之前会改回版本号**：

```json
"@flun/nodejs-mobile-gyp": "^1.0.1"
```

**用户从 npm 安装时不会看到 `file:` 路径**,npm 会正常把 gyp 作为 registry 依赖安装,也不会出现第 4、5、6 条中的 junction / 嵌套 / robocopy 问题——那些坑是本地 `file:` + 手工实体拷贝独有的;

## 使用

### Node.js 项目

`@flun/nodejs-mobile-react-native` 安装后,会在你的应用里生成 `nodejs-assets/nodejs-project/` 目录;这个目录会被打进 APK/IPA,Node 引擎启动时会从这里加载 `main.js`;

目录里包含两个示例文件：

- `sample-main.js`
- `sample-package.json`

建议把它们重命名为 `main.js` 和 `package.json` 后开始开发;

> **注意**：`sample-main.js` 和 `sample-package.json` 会在安装/更新 `@flun/nodejs-mobile-react-native` 时被覆盖,不要直接改动它们;

`main.js` 示例内容（ESM 写法）：

```js
import rn_bridge from 'rn-bridge'

// 把收到的每条 react-native 消息回显;
rn_bridge.channel.on('message', (msg) => {
  rn_bridge.channel.send(msg)
})

// 通知 react-native：Node 已初始化;
rn_bridge.channel.send('Node was initialized.')
```

> **注意**：如果用户项目用 CJS,`main.js` 里写 `require('rn-bridge')` 也行;两种方式都能加载 rn-bridge;

React Native 的打包器（Metro）有时会误把 `nodejs-project/` 里的 JS 也当作应用代码,导致 `Haste module naming collision` 错误;解决办法见下方"故障排查"章节;

Node.js 运行时通过 Unix 风格的路径访问文件;Android 上,Node 项目会在应用首次启动（或更新后）从 APK 的 assets 复制到默认应用数据目录下的 `nodejs-project/`;

> **注意**：应用每次更新后项目目录会被覆盖,不要把它当作持久化存储;持久化请用 `rn_bridge.app.datadir()`;

为了加速资源解压（避免递归遍历 assets 目录）,编译时会把文件清单 `file.list` 和目录清单 `dir.list` 一起打进 assets;这在 Android 6.x 及更旧版本上能规避 assets manager 的一个严重性能 bug;

#### Node 模块

在 `nodejs-assets/nodejs-project/` 里跑 `npm install` 即可添加 Node 模块（前提是已有 `package.json`）;

#### 原生模块

Linux 与 macOS 上支持编译带原生代码的模块;

插件会扫描 `nodejs-project` 目录下的 `.gyp` 文件,自动识别原生模块;构建前请先按 [nodejs-mobile 的文档](https://github.com/nodejs-mobile/nodejs-mobile) 装好 Android / iOS 的编译前置工具链;Android 上建议设置环境变量 `ANDROID_NDK_HOME`;

Android 上编译原生模块耗时较长（要为每个架构构建独立的 NDK 工具链）;编译产物 `.node` 会按架构分开打进应用,运行时选择正确的那个;

如果想手动控制开关,可以创建 `nodejs-assets/BUILD_NATIVE_MODULES.txt`：

- 内容 `1`：强制启用编译
- 内容 `0`：强制关闭编译

例如：

```sh
echo "1" > nodejs-assets/BUILD_NATIVE_MODULES.txt
react-native run-android
```

##### Prebuilds（预编译产物）

插件会自动检测预编译的 `.node` 文件并**关闭该模块的即时编译**;识别路径：

```
nodejs-assets/nodejs-project/node_modules/<MODULE_NAME>/prebuilds/<PLATFORM>-<ARCH>/<NAME>.node
```

支持的组合：

- PLATFORM = `android`
  - ARCH = `arm`
  - ARCH = `arm64`
  - ARCH = `x64`
- PLATFORM = `ios`
  - ARCH = `arm64`
  - ARCH = `x64`

检测到 prebuild 后,插件会删除该模块的 `binding.gyp` 并修改 `package.json`,让 node-gyp 忽略它;

如果你是原生模块作者,想为自己的模块提供 nodejs-mobile 的 prebuild,参考 CLI 工具 [prebuild-for-nodejs-mobile](https://github.com/staltz/prebuild-for-nodejs-mobile);

### React Native 应用

先从 React Native 侧导入：

```js
import nodejs from '@flun/nodejs-mobile-react-native'
```

在应用主组件的生命周期里启动 Node：

```js
nodejs.start('main.js')
nodejs.channel.addListener(
  'message', msg => alert('From node: ' + msg), this
)
```

这会告诉原生代码启动一个专用线程,从 `nodejs-assets/nodejs-project/main.js` 开始运行 Node,并在收到 Node 消息时弹窗显示;

> **注意**：Node 项目以单例形式运行在独立线程上,只有第一次 `nodejs.start()` 生效,后续调用不会启动新线程;这意味着 react-native 的热重载不会影响 Node 项目,需要重启应用;

发送消息给 Node：

```js
<Button title="Message Node"
  onPress={() => nodejs.channel.send('A message!')}
/>
```

## React Native 层 API

从 React Native 代码直接调用：

```js
import nodejs from '@flun/nodejs-mobile-react-native'
```

可用方法：

- `nodejs.start`
- `nodejs.startWithArgs`
- `nodejs.startWithScript`
- `nodejs.channel.addListener`
- `nodejs.channel.removeListener`
- `nodejs.channel.post`
- `nodejs.channel.send`

> `nodejs.channel.send(...msg)` 等价于 `nodejs.channel.post('message', ...msg)`,保留是为了向后兼容;

> `nodejs.channel` 继承自 [React Native 的 `EventEmitter` 类](https://github.com/facebook/react-native/blob/055c941c4045468af4ff2b8162d3a35dd993b1b9/Libraries/vendor/emitter/EventEmitter.js),去掉 `emit`,增加 `post` 和 `send`;

### nodejs.start(scriptFileName [, options])

| 参数           | 类型             |
| -------------- | ---------------- |
| scriptFileName | `string`         |
| options        | `StartupOptions` |

从 `nodejs-project` 目录下的某个文件启动 nodejs-mobile 运行时线程;

### nodejs.startWithArgs(command [, options])

| 参数    | 类型             |
| ------- | ---------------- |
| command | `string`         |
| options | `StartupOptions` |

从 `nodejs-project` 目录下的某个文件启动,并把额外参数传给它;`command` 通常包含脚本文件名作为第一个参数,例如：

```
command = 'main.js --insecure-http-parser --zero-fill-buffers'
```

### nodejs.startWithScript(scriptBody [, options])

| 参数       | 类型             |
| ---------- | ---------------- |
| scriptBody | `string`         |
| options    | `StartupOptions` |

用一个脚本字符串启动 nodejs-mobile 运行时线程;

### nodejs.channel.addListener(event, callback)

| 参数     | 类型       |
| -------- | ---------- |
| event    | `string`   |
| callback | `function` |

为 Node 侧发出的自定义事件注册回调;

### nodejs.channel.removeListener(event, callback)

| 参数     | 类型       |
| -------- | ---------- |
| event    | `string`   |
| callback | `function` |

移除之前通过 `addListener` 注册的回调。`callback` 必须与注册时传入的是同一个函数引用。

### nodejs.channel.post(event, ...message)

| 参数       | 类型                                                              |
| ---------- | ----------------------------------------------------------------- |
| event      | `string`                                                          |
| ...message | 任何可用 `JSON.stringify` 序列化、`JSON.parse` 反序列化的 JS 类型 |

在 Node 侧触发一个自定义事件;

### nodejs.channel.send(...message)

| 参数       | 类型                                                              |
| ---------- | ----------------------------------------------------------------- |
| ...message | 任何可用 `JSON.stringify` 序列化、`JSON.parse` 反序列化的 JS 类型 |

在 Node 侧触发一个 `'message'` 事件;是 `nodejs.channel.post('message', ...message)` 的别名;

### StartupOptions: `object`

| 名称                   | 类型      | 默认值 | 说明                                                 |
| ---------------------- | --------- | ------ | ---------------------------------------------------- |
| redirectOutputToLogcat | `boolean` | `true` | 是否把 Node 的 stdout/stderr 重定向到 Android logcat |

## Node 层 API（rn-bridge）

从 Node 代码通过 `rn-bridge` 模块调用：

```js
const rn_bridge = require('rn-bridge')
```

可用方法：

- `rn_bridge.channel.on`
- `rn_bridge.channel.removeListener`
- `rn_bridge.channel.post`
- `rn_bridge.channel.send`
- `rn_bridge.app.on`
- `rn_bridge.app.datadir`

> `rn_bridge.channel.send(...msg)` 等价于 `rn_bridge.channel.post('message', ...msg)`,保留是为了向后兼容;

> `rn_bridge.channel` 继承自 [Node 的 `EventEmitter` 类](https://github.com/nodejs-mobile/nodejs-mobile/blob/9e90dd8c14fce5b047aa16d00e22a8ef44222a99/lib/events.js),去掉 `emit`,增加 `post` 和 `send`;

### rn_bridge.channel.on(event, callback)

| 参数     | 类型       |
| -------- | ---------- |
| event    | `string`   |
| callback | `function` |

为 React Native 侧发出的自定义事件注册回调;

> 接收 `nodejs.channel.send` 的消息,用：
> ```js
> rn_bridge.channel.on('message', listenerCallback)
> ```

### rn_bridge.channel.removeListener(event, callback)

| 参数     | 类型       |
| -------- | ---------- |
| event    | `string`   |
| callback | `function` |

移除之前通过 `on` 注册的回调。`callback` 必须与注册时传入的是同一个函数引用。

### rn_bridge.channel.post(event, ...message)

| 参数       | 类型                                                              |
| ---------- | ----------------------------------------------------------------- |
| event      | `string`                                                          |
| ...message | 任何可用 `JSON.stringify` 序列化、`JSON.parse` 反序列化的 JS 类型 |

在 React Native 侧触发一个自定义事件;

### rn_bridge.channel.send(...message)

| 参数       | 类型                                                              |
| ---------- | ----------------------------------------------------------------- |
| ...message | 任何可用 `JSON.stringify` 序列化、`JSON.parse` 反序列化的 JS 类型 |

在 React Native 侧触发一个 `'message'` 事件;是 `rn_bridge.channel.post('message', ...message)` 的别名;

### rn_bridge.app.on(event, callback)

| 参数     | 类型       |
| -------- | ---------- |
| event    | `string`   |
| callback | `function` |

注册 App 事件回调;当前支持 `'pause'` 和 `'resume'`,分别在应用进入后台/前台时自动触发;

```js
rn_bridge.app.on('pause', (pauseLock) => {
  console.log('[node] app paused.')
  pauseLock.release()
})
rn_bridge.app.on('resume', () => {
  console.log('[node] app resumed.')
})
```

`'pause'` 事件在应用切到后台时触发;iOS 上系统会等待所有 `'pause'` 处理器返回后才真正挂起应用;为了让 iOS 知道何时可以安全挂起,每个 `'pause'` 监听器会收到一个 `pauseLock` 参数,调用它的 `release()` 表示该监听器已经完成工作;所有锁都释放后（或 iOS 强制挂起）,应用才会进入挂起状态;

```js
rn_bridge.app.on('pause', (pauseLock) => {
  server.close(() => {
    // 服务器停止监听、当前连接全部关闭后,应用才会挂起;
    pauseLock.release()
  })
})
```

> **警告**：iOS 上应用最终一定会被挂起;`pause` 事件里应尽快完成清理,并确保每个监听器都调用 `pauseLock.release()`,否则应用会在 iOS 允许的范围内一直占用后台;

### rn_bridge.app.datadir()

返回一个可写的持久化数据目录;iOS 上是 `NSDocumentDirectory`,Android 上是 `FilesDir`;

### Channel 回调：`function(arg)`

| 名称 | 类型                                                              |
| ---- | ----------------------------------------------------------------- |
| arg  | 任何可用 `JSON.stringify` 序列化、`JSON.parse` 反序列化的 JS 类型 |

通道内部用 `JSON.stringify` 序列化、`JSON.parse` 反序列化;这意味着：

- JS 的 `Date` 会被转成字符串
- 函数会从对象里被剔除
- 只支持 `Boolean`、`Number`、`String`、`Object`、`Array` 这些类型（符合 [JSON 数据交换语法标准](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf)）

## 其他 Node API 说明

### os.tmpdir()

- **iOS**：`os.tmpdir()` 返回一个临时目录,因为 iOS 会把应用的 `TMPDIR` 环境变量设为 `NSTemporaryDirectory` 的等价路径;
- **Android**：Android 系统没有为应用定义临时目录,插件会把 `TMPDIR` 环境变量设为应用上下文 `CacheDir` 的值;

## 故障排查

### Android 构建缓存

Android 上 react-native 有时无法正确重建 assets;如果 `react-native run-android` 报错,可以手动清 Gradle 缓存后重试：

Windows：
```sh
cd android
gradlew clean
cd ..
react-native run-android
```

Linux/macOS：
```sh
cd android
./gradlew clean
cd ..
react-native run-android
```

### Duplicate module name（模块重名）

react-native 打包时会把 `nodejs-project` 复制到应用 assets,同时 Metro 又会监控项目里的 JS 文件,可能报 `jest-haste-map: Haste module naming collision` 错误;

解决办法：让 Metro 忽略 `nodejs-project` 以及它被复制到的平台目录;在项目的 `metro.config.js` 里加入 `blacklist`（react-native >= 0.60）：

```js
const blacklist = require('metro-config/src/defaults/exclusionList')

export default {
  resolver: {
    blacklistRE: blacklist([
      /\/nodejs-assets\/.*/,
      /\/android\/.*/,
      /\/ios\/.*/
    ])
  },
  // ...
}
```

## 更新日志

见本包根目录的 [CHANGELOG.md](./CHANGELOG.md);

## 版本策略

本 fork **遵循 [SemVer](https://semver.org/)**：

- **major**：底层 runtime 或依赖发生重大变更（比如更换 Node 版本、更换底层插件）
- **minor**：新增功能,向后兼容
- **patch**：修复 Bug,向后兼容

与上游原版"跟随 Node 版本号"的策略不同,本 fork 的版本号独立于 Node 版本——本 fork 基于的 Node 版本写在 `package.json` 的 `description` 与本文档中;

## 许可

MIT