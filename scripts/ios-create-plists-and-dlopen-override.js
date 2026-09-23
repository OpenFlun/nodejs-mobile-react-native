import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * 遍历项目目录，找出所有原生模块编译出的 .node 框架
 */
const visitEveryFramework = (projectPath) => {
  const foundFrameworks = []
  let countInvalidFrameworks = 0
  let countValidFrameworks = 0

  const recursivelyFindFrameworks = (currentPath) => {
    const currentFiles = fs.readdirSync(currentPath)
    for (let i = 0; i < currentFiles.length; i++) {
      const currentFilename = path.normalize(
        path.join(currentPath, currentFiles[i]),
      )
      if (fs.lstatSync(currentFilename).isDirectory()) {
        if (currentFilename.endsWith('.node')) {
          const frameworkContents = fs.readdirSync(currentFilename)
          // nodejs-mobile-gyp 产出的框架应只包含一个文件，
          // 对应正确的共享库。
          if (frameworkContents.length != 1) {
            console.log(
              'Skipping a ".node". Expected to find only one file inside this path: ' +
                currentFilename,
            )
            countInvalidFrameworks++
          } else {
            const currentBinaryName = frameworkContents[0]
            const checkFileType = spawnSync('file', [
              path.join(currentFilename, currentBinaryName),
            ])
            // .framework 里的文件应是动态链接共享库。
            if (
              checkFileType.stdout
                .toString()
                .indexOf('dynamically linked shared library') > -1
            ) {
              const newFrameworkObject = {
                originalFileName: currentFilename,
                originalRelativePath: '',
                originalBinaryName: currentBinaryName,
                newFrameworkName: '',
                newFrameworkFileName: '',
              }
              foundFrameworks.push(newFrameworkObject)
              countValidFrameworks++
            } else {
              console.log(
                'Skipping a ".node". Couldn\'t find a dynamically linked shared library inside ' +
                  currentFilename +
                  ' because ' +
                  checkFileType.stdout.toString(),
              )
              countInvalidFrameworks++
            }
          }
        }
        recursivelyFindFrameworks(currentFilename)
      }
    }
  }
  recursivelyFindFrameworks(projectPath)

  console.log(
    'Found ' +
      countValidFrameworks +
      ' valid frameworks and ' +
      countInvalidFrameworks +
      ' invalid frameworks after rebuilding the native modules for iOS.',
  )
  if (foundFrameworks.length < 1) {
    console.log(
      'No valid framework native modules were found. Skipping integrating them into the App.',
    )
    return
  }

  for (let i = 0; i < foundFrameworks.length; i++) {
    // 为每个框架填充辅助字段。
    const currentFramework = foundFrameworks[i]
    currentFramework.originalRelativePath = path.relative(
      projectPath,
      currentFramework.originalFileName,
    )

    // 为了让每个框架在嵌入时名字唯一，用相对路径的摘要作为名字。
    const hash = crypto.createHash('sha1')
    hash.update(currentFramework.originalRelativePath)
    currentFramework.newFrameworkName = 'node' + hash.digest('hex')
    currentFramework.newFrameworkFileName = path.join(
      path.dirname(currentFramework.originalFileName),
      currentFramework.newFrameworkName + '.framework',
    )
  }

  for (let i = 0; i < foundFrameworks.length; i++) {
    // 把二进制重命名为新的框架结构，并加入 .plist
    const currentFramework = foundFrameworks[i]
    fs.renameSync(
      currentFramework.originalFileName,
      currentFramework.newFrameworkFileName,
    )
    fs.renameSync(
      path.join(
        currentFramework.newFrameworkFileName,
        currentFramework.originalBinaryName,
      ),
      path.join(
        currentFramework.newFrameworkFileName,
        currentFramework.newFrameworkName,
      ),
    )

    // 读取 Info.plist 模板
    let plistXmlContents = fs
      .readFileSync(path.join(__dirname, 'plisttemplate.xml'))
      .toString()

    // 用新 bundle 名和 Xcode 环境变量替换占位符。
    plistXmlContents = plistXmlContents
      .replace(
        /\{ENV_MAC_OS_X_PRODUCT_BUILD_VERSION\}/g,
        process.env.MAC_OS_X_PRODUCT_BUILD_VERSION,
      )
      .replace(/\{VAR_BINARY_NAME\}/g, currentFramework.newFrameworkName)
      .replace(/\{ENV_DEFAULT_COMPILER\}/g, process.env.DEFAULT_COMPILER)
      .replace(
        /\{ENV_PLATFORM_PRODUCT_BUILD_VERSION\}/g,
        process.env.PLATFORM_PRODUCT_BUILD_VERSION,
      )
      .replace(/\{ENV_SDK_VERSION\}/g, process.env.SDK_VERSION)
      .replace(
        /\{ENV_SDK_PRODUCT_BUILD_VERSION\}/g,
        process.env.SDK_PRODUCT_BUILD_VERSION,
      )
      .replace(/\{ENV_SDK_NAME\}/g, process.env.SDK_NAME)
      .replace(
        /\{ENV_XCODE_VERSION_ACTUAL\}/g,
        process.env.XCODE_VERSION_ACTUAL,
      )
      .replace(
        /\{ENV_XCODE_PRODUCT_BUILD_VERSION\}/g,
        process.env.XCODE_PRODUCT_BUILD_VERSION,
      )

    // 用 plutil 生成二进制格式的 plist。
    spawnSync(
      'plutil',
      [
        '-convert',
        'binary1', // 把 xml plist 转成二进制
        '-o',
        path.join(currentFramework.newFrameworkFileName, 'Info.plist'), // 目标 Info.plist 路径
        '-', // 从 stdin 读输入
      ],
      {
        input: plistXmlContents,
      },
    )
  }

  const frameworkOverrideContents = []
  for (let i = 0; i < foundFrameworks.length; i++) {
    // 生成 JSON 文件内容，用于运行时覆盖 dlopen 调用。
    const currentFramework = foundFrameworks[i]
    frameworkOverrideContents.push({
      originalpath: currentFramework.originalRelativePath.split(path.sep),
      newpath: [
        '..',
        'Frameworks',
        currentFramework.newFrameworkName + '.framework',
        currentFramework.newFrameworkName,
      ],
    })
  }
  fs.writeFileSync(
    path.join(projectPath, 'override-dlopen-paths-data.json'),
    JSON.stringify(frameworkOverrideContents),
  )

  // 拷贝用于覆盖 dlopen 路径的运行时脚本。
  fs.copyFileSync(
    path.join(__dirname, 'override-dlopen-paths-preload.js'),
    path.join(projectPath, 'override-dlopen-paths-preload.js'),
  )

  for (let i = 0; i < foundFrameworks.length; i++) {
    // 在原 .node 位置留一个空文件，有些模块会检查它的存在。
    fs.closeSync(fs.openSync(foundFrameworks[i].originalFileName, 'w'))
  }
}

if (process.argv.length >= 3) {
  if (fs.existsSync(process.argv[2])) {
    visitEveryFramework(path.normalize(process.argv[2]))
  }
  process.exit(0)
} else {
  console.error('需要传入一个路径参数。')
  process.exit(1)
}
