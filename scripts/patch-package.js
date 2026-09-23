import fs from 'fs'
import path from 'path'

/**
 * 补丁 package.json：某些模块的 binary 字段带运行时变量替换，
 * 但移动端交叉编译时，build 期与 runtime 的取值不同，
 * 因此提前用固定值替换掉。
 */
const patchPackageJSON_preNodeGyp_modulePath = (packageJSONPath) => {
  const packageJSONReadData = fs.readFileSync(packageJSONPath)
  const packageJSON = JSON.parse(packageJSONReadData)
  if (!packageJSON) return
  if (!packageJSON.binary) return
  if (!packageJSON.binary.module_path) return
  let binaryPathConfiguration = packageJSON.binary.module_path
  binaryPathConfiguration = binaryPathConfiguration.replace(
    /\{node_abi\}/g,
    'node_abi',
  )
  binaryPathConfiguration = binaryPathConfiguration.replace(
    /\{platform\}/g,
    'platform',
  )
  binaryPathConfiguration = binaryPathConfiguration.replace(
    /\{arch\}/g,
    'arch',
  )
  binaryPathConfiguration = binaryPathConfiguration.replace(
    /\{target_arch\}/g,
    'target_arch',
  )
  binaryPathConfiguration = binaryPathConfiguration.replace(
    /\{libc\}/g,
    'libc',
  )
  packageJSON.binary.module_path = binaryPathConfiguration
  const packageJSONWriteData = JSON.stringify(packageJSON, null, 2)
  fs.writeFileSync(packageJSONPath, packageJSONWriteData)
}

/**
 * npm 7+ 起，环境变量 npm_config_node_gyp（scripts/ios-build-native-modules.sh 依赖它）
 * 不再传给 package scripts。因此这里逐个模块补丁 package.json，
 * 把 node-gyp-build 替换为我们的分支 node-gyp-build-mobile。
 * 该分支读取另一个环境变量（由 scripts/ios-build-native-modules.sh 设置），
 * 指向 nodejs-mobile-gyp。
 */
const patchPackageJSONNodeGypBuild = (packageJSONPath) => {
  const packageJSONReadData = fs.readFileSync(packageJSONPath)
  let packageJSON
  try {
    packageJSON = JSON.parse(packageJSONReadData)
  } catch (err) {
    console.log(
      'nodejs-mobile-react-native patcher failed to parse ' + packageJSONPath,
    )
    return
  }
  if (!packageJSON) return
  if (!packageJSON.scripts) return
  if (!packageJSON.scripts.install) return
  if (!packageJSON.scripts.install.includes('node-gyp-build')) return
  packageJSON.scripts.install = packageJSON.scripts.install.replace(
    /node-gyp-build(?!-)/g,
    '$PROJECT_DIR/../node_modules/.bin/node-gyp-build-mobile',
  )
  const packageJSONWriteData = JSON.stringify(packageJSON, null, 2)
  fs.writeFileSync(packageJSONPath, packageJSONWriteData)
}

/**
 * 递归遍历所有 package.json 并应用补丁
 */
const visitPackageJSON = (folderPath) => {
  const files = fs.readdirSync(folderPath)
  for (const name of files) {
    const filePath = path.join(folderPath, name)
    if (fs.lstatSync(filePath).isDirectory()) {
      visitPackageJSON(filePath)
    } else {
      if (name === 'package.json') {
        try {
          patchPackageJSON_preNodeGyp_modulePath(filePath)
          patchPackageJSONNodeGypBuild(filePath)
        } catch (e) {
          console.warn(
            'Failed to patch the file : "' +
              filePath +
              '". The following error was thrown: ' +
              JSON.stringify(e),
          )
        }
      }
    }
  }
}

if (process.argv.length >= 3) {
  if (fs.existsSync(process.argv[2])) {
    visitPackageJSON(process.argv[2])
  }
  process.exit(0)
} else {
  console.error('需要传入一个路径参数。')
  process.exit(1)
}
