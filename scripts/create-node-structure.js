// 改编自 www.npmjs.com/package/install-files 项目
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url), ncp = require('ncp'), __filename = fileURLToPath(import.meta.url),
  /**
   * 从文件路径推断宿主包目录（node_modules 的上一级）
   */
  hostPackageDir = file => {
    const pathComponents = file.split(path.sep), modulesDirIndex = pathComponents.indexOf('node_modules');

    if (modulesDirIndex < 1) return undefined
    return pathComponents.slice(0, modulesDirIndex).join(path.sep)
  },
  /**
   * 写一个 macOS 辅助脚本：当指定命令不在 PATH 时，供 Gradle 在 macOS 上调用。
   * 脚本会注入当前进程的 PATH，避免从非命令行（如 Android Studio）启动时找不到命令。
   */
  writeMacOSHelperScript = (target, name, cmd) => {
    fs.writeFileSync(
      path.join(target, name),
      '#!/bin/bash\n' + '# 辅助脚本：当 ' + cmd + ' 不在 PATH 时供 Gradle 在 macOS 上调用\n' +
      'export PATH=$PATH:' + process.env.PATH + '\n' + cmd + ' $@\n', { mode: 0o755 });
  },
  /**
   * 把插件内的 nodejs-assets 复制到宿主项目根
   */
  installFiles = done => {
    const lifecycleEvent = process.env.npm_lifecycle_event,
      packageIsInstalling = lifecycleEvent === 'install' || lifecycleEvent === 'postinstall';

    if (!packageIsInstalling) {
      const error1 = new Error(
        "This module is meant to be invoked from a package's 'install' or 'postinstall' script.",
      );
      process.nextTick(() => done(error1));
      return
    }

    const scriptPath = __filename, scriptDir = path.dirname(scriptPath), packageDir = path.dirname(scriptDir),
      source = path.join(packageDir, 'install', 'resources', 'nodejs-assets');

    // 正在执行 install / postinstall 的包所在路径
    let fileInstallingPackagePath = hostPackageDir(scriptPath) || process.env.INIT_CWD, target = fileInstallingPackagePath
    if (!target) {
      const error2 = new Error('Could not determine the install destination directory.',);
      process.nextTick(() => done(error2));
      return;
    }

    // 如果安装目标就是本包自身，静默跳过
    if (path.resolve(fileInstallingPackagePath) === path.resolve(packageDir)) {
      process.nextTick(() => done());
      return;
    }

    // 如果宿主项目依赖 @flun/node-mobile-app，说明本包是被它带下来的，
    // node-mobile-app 有自己的模板拷贝逻辑，此处跳过避免重复与误解。
    try {
      const hostPkgPath = path.join(fileInstallingPackagePath, 'package.json');
      if (fs.existsSync(hostPkgPath)) {
        const hostPkg = JSON.parse(fs.readFileSync(hostPkgPath, 'utf-8')),
          allDeps = { ...(hostPkg.dependencies || {}), ...(hostPkg.devDependencies || {}) };
        if (allDeps['@flun/node-mobile-app']) {
          console.log('  [create-node-structure] 宿主项目依赖 @flun/node-mobile-app，跳过 nodejs-assets 复制');
          process.nextTick(() => done());
          return;
        }
      }
    } catch (e) { }  // 解析宿主 package.json 失败不阻断流程

    target = path.join(target, 'nodejs-assets')
    // 确保目标路径存在（Node 10+ 原生支持递归建目录，无需 mkdirp 依赖）
    try {
      fs.mkdirSync(target, { recursive: true })
    } catch (err) { return process.nextTick(() => done(err)) }

    const options = { clobber: true }; // 覆盖同名文件，仅复制 node-assets
    ncp(source, target, options, done);
    if (process.platform === 'darwin') {
      // 添加辅助脚本，用当前 PATH 运行 "npm rebuild" 和 "node"。
      // 这是为了 macOS 上从非命令行启动的 Android Studio——
      // 构建时 npm 和 node 通常不在 PATH 里。
      writeMacOSHelperScript(target, 'build-native-modules-MacOS-helper-script-npm.sh', 'npm');
      writeMacOSHelperScript(target, 'build-native-modules-MacOS-helper-script-node.sh', 'node');
    }
  };

installFiles(err => {
  if (err) console.error(err);
})
