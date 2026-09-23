// 改编自 www.npmjs.com/package/install-files 项目

import path from 'path'
import fs from 'fs'
import ncp from 'ncp'
import mkdirp from 'mkdirp'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)

/**
 * 从文件路径推断宿主包目录（node_modules 的上一级）
 */
const hostPackageDir = (file) => {
  const pathComponents = file.split(path.sep)
  const modulesDirIndex = pathComponents.lastIndexOf('node_modules')
  if (modulesDirIndex < 1) return undefined

  return pathComponents.slice(0, modulesDirIndex).join(path.sep)
}

/**
 * 把插件内的 nodejs-assets 复制到宿主项目根
 */
const installFiles = (done) => {
  const lifecycleEvent = process.env.npm_lifecycle_event
  const packageIsInstalling =
    lifecycleEvent === 'install' || lifecycleEvent === 'postinstall'
  if (!packageIsInstalling) {
    const error1 = new Error(
      "This module is meant to be invoked from a package's 'install' or 'postinstall' script.",
    )
    process.nextTick(() => done(error1))
    return
  }

  const scriptPath = __filename
  const scriptDir = path.dirname(scriptPath)
  const packageDir = path.dirname(scriptDir)

  // 正在执行 install / postinstall 的包所在路径
  let fileInstallingPackagePath = hostPackageDir(scriptPath) || process.env.INIT_CWD

  const source = path.join(packageDir, 'install', 'resources', 'nodejs-assets')
  let target = fileInstallingPackagePath

  if (!target) {
    const error2 = new Error(
      'Could not determine the install destination directory.',
    )
    process.nextTick(() => done(error2))
    return
  }

  // 如果安装目标就是本包自身，静默跳过
  if (path.resolve(fileInstallingPackagePath) === path.resolve(packageDir)) {
    process.nextTick(() => done())
    return
  }

  target = path.join(target, 'nodejs-assets')

  // 确保目标路径存在
  mkdirp(target, (err) => {
    if (err) process.nextTick(() => done(err))
    return
  })

  // 覆盖同名文件，仅复制 node-assets
  const options = {
    clobber: true,
  }

  ncp(source, target, options, done)

  if (process.platform === 'darwin') {
    // 添加辅助脚本，用当前 PATH 运行 "npm rebuild" 和 "node"。
    // 这是为了 macOS 上从非命令行启动的 Android Studio——
    // 构建时 npm 和 node 通常不在 PATH 里。
    let helperMacOSBuildScriptPath = path.join(
      target,
      'build-native-modules-MacOS-helper-script-npm.sh',
    )
    fs.writeFileSync(
      helperMacOSBuildScriptPath,
      `#!/bin/bash
      # 辅助脚本：当 npm 不在 PATH 时供 Gradle 在 macOS 上调用
      export PATH=$PATH:${process.env.PATH}
      npm $@
    `,
      { mode: 0o755 },
    )
    helperMacOSBuildScriptPath = path.join(
      target,
      'build-native-modules-MacOS-helper-script-node.sh',
    )
    fs.writeFileSync(
      helperMacOSBuildScriptPath,
      `#!/bin/bash
      # 辅助脚本：当 node 不在 PATH 时供 Gradle 在 macOS 上调用
      export PATH=$PATH:${process.env.PATH}
      node $@
    `,
      { mode: 0o755 },
    )
  }
}

installFiles((err) => {
  if (err) console.error(err)
})
