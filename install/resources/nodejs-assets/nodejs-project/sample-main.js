// 使用时请把本示例文件重命名为 main.js。
// main.js 会在更新 / 重装时被覆盖。

import rn_bridge from 'rn-bridge'

// 把收到的每条 React Native 消息回显。
rn_bridge.channel.on('message', (msg) => {
  rn_bridge.channel.send(msg)
})

// 通知 React Native：Node 已初始化。
rn_bridge.channel.send('Node was initialized.')
