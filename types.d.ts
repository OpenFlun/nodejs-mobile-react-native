/**
 * 通道消息回调
 * - 参数可以是任何能用 JSON.stringify 序列化、JSON.parse 反序列化的类型
 * - 支持多个参数
 * > 查看定义：{@link ChannelCallback}
 * @param arg 消息内容，类型可以是：`boolean`、`number`、`string`、`object`、`array`
 */
export type ChannelCallback = (...arg: any[]) => void

/**
 * `start`、`startWithArgs` 和 `startWithScript` 的可选启动选项
 * > 查看定义：{@link StartupOptions}
 */
export interface StartupOptions {
    /**
     * 是否把 Node 的 stdout/stderr 重定向到 Android logcat
     * @default true
     */
    redirectOutputToLogcat?: boolean
}