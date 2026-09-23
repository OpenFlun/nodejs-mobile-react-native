import { start, startWithArgs, startWithScript, channel } from './native.js';
import { ChannelCallback } from './types.d.ts';

/**
 * 事件通道类
 * 对应 native.js 中的 EventChannel,继承自 EventEmitter
 * > 查看定义：{@link EventChannel}
 */
declare class EventChannel {
  /**
   * 为 Node 侧发出的自定义事件注册回调
   * @param event 事件名
   * @param callback 回调函数
   * @param context 回调的 this 上下文
   */
  addListener(event: string, callback: ChannelCallback, context?: any): void

  /**
   * 移除已注册的事件回调
   * @param event 事件名
   * @param callback 注册时传入的回调函数
   * @param context 注册时传入的 this 上下文
   */
  removeListener(event: string, callback: ChannelCallback, context?: any): void

  /**
   * 在 Node 侧触发一个自定义事件
   * @param event 事件名
   * @param message 消息内容，支持多个参数
   */
  post(event: string, ...message: any[]): void

  /**
   * 触发 `'message'` 事件，是 `post('message', ...)` 的别名
   * @param message 消息内容，支持多个参数
   */
  send(...message: any[]): void
}

/**
 * 与 Node 侧双向通信的事件通道
 * > 查看定义：{@link channel}
 */
export const channel: EventChannel
// =================================== 模块导出入口 ===================================
/**
 * @flun/nodejs-mobile-react-native 模块
 *
 * 主要功能：
 * ```js
 * start('main.js');                    // 启动 Node.js Mobile 运行时
 * startWithArgs('main.js --config x'); // 带参数启动
 * startWithScript('console.log(1)');   // 用脚本字符串启动
 * channel.post('event', data);         // 向 Node 侧发送事件
 * ```
 *
 * > 查看定义：{@link start}、{@link startWithArgs}、{@link startWithScript}、{@link channel}
 *
 * @example
 * import { start, startWithArgs, startWithScript, channel } from '@flun/nodejs-mobile-react-native';
 *
 * // 1. 启动默认入口
 * start('main.js');
 *
 * // 2. 带参数启动
 * startWithArgs('main.js --config custom.json');
 *
 * // 3. 用脚本字符串启动
 * startWithScript('console.log("hello from node")');
 *
 * // 4. 与 Node 侧通信
 * channel.addListener('message', (msg) => {
 *   console.log('收到 Node 消息:', msg);
 * });
 * channel.post('hello', { a: 1 });
 */
declare module './index.js' {
  export { start, startWithArgs, startWithScript, channel }
}
export { ChannelCallback, StartupOptions } from './types.d.ts';