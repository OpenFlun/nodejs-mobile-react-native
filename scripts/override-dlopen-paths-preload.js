/**
 * 运行时 preload：覆盖 process.dlopen，把原生模块从原始路径映射到 App 的 Frameworks 目录。
 *
 * 本文件以 ESM 书写。node -r 加载本文件时，按加载方（宿主项目）的 package.json type 解析：
 *   - 宿主项目 "type": "module"   →  正常按 ESM 加载
 *   - 宿主项目 无 type 或 "commonjs" →  会按 CJS 加载，报 ERR_REQUIRE_ESM
 *
 * 若宿主项目为 CJS，请任选一种处理：
 *   1. 把本文件改名为 override-dlopen-paths-preload.mjs（.mjs 强制 ESM，任何宿主项目都能按 ESM 加载）
 *   2. 在宿主项目 package.json 里加 "type": "module"
 *   3. 使用 Node 20.6+ 的 --import 代替 -r（需同步改 iOS 侧 RNNodeJsMobile.m）
 *
 * iOS 端由 scripts/ios-create-plists-and-dlopen-override.js 拷贝到 Node 项目根，
 * 再由 RNNodeJsMobile.m 以 node -r 方式加载。
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const substitutionDataFile = path.join(
  __dirname,
  'override-dlopen-paths-data.json',
)
// 若该 json 文件存在，则覆盖 dlopen，改为加载指定的框架路径。
if (fs.existsSync(substitutionDataFile)) {
  const pathSubstitutionData = JSON.parse(
    fs.readFileSync(substitutionDataFile, 'utf8'),
  )

  const pathSubstitutionDictionary = {}
  // 构建字典，在运行时按当前沙盒路径转换路径。
  for (let i = 0; i < pathSubstitutionData.length; i++) {
    pathSubstitutionDictionary[
      path.normalize(
        path.join(
          ...([__dirname].concat(pathSubstitutionData[i].originalpath)),
        ),
      )
    ] = path.normalize(
      path.join(
        ...([__dirname].concat(pathSubstitutionData[i].newpath)),
      ),
    )
  }

  const old_dlopen = process.dlopen
  // 覆盖 process.dlopen
  process.dlopen = function (_module, _filename) {
    if (pathSubstitutionDictionary[path.normalize(_filename)]) {
      _filename = pathSubstitutionDictionary[path.normalize(_filename)]
    }
    old_dlopen(_module, _filename)
  }
}
