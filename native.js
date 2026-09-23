import { NativeModules, NativeAppEventEmitter } from 'react-native'
import EventEmitter from 'react-native/Libraries/vendor/emitter/EventEmitter'

const channels = {}, { RNNodeJsMobile } = NativeModules;
/**
 * 本类也在 rn-bridge/index.js 中定义。
 * 任何修改都应同步到 rn-bridge/index.js。
 * MessageCodec 提供两个静态方法,用于序列化 / 反序列化通过事件通道发送的数据。
 */
class MessageCodec {
    // 私有构造,仅由本类的静态方法使用
    constructor(_event, ..._payload) {
        this.event = _event, this.payload = JSON.stringify(_payload)
    }

    // 序列化事件名与负载
    static serialize(event, ...payload) {
        const envelope = new MessageCodec(event, ...payload)
        return JSON.stringify(envelope); // 返回可经通道发送的序列化消息
    }

    // 反序列化事件名与负载
    static deserialize(message) {
        const envelope = JSON.parse(message)
        if (typeof envelope.payload !== 'undefined') envelope.payload = JSON.parse(envelope.payload);
        return envelope
    }
}

/**
 * Channel 父类。
 */
class ChannelSuper extends EventEmitter {
    constructor(name) {
        super()
        this.name = name
        // 把 'emit' 改名为 'emitLocal' 不是必须的,但能明确：
        // 在该对象上"emit"只有本地作用域——事件只在 Node 侧触发,不会发送到 React Native;
        this.emitLocal = this.emit
        delete this.emit
    }
}

/**
 * 事件通道类：支持用户自定义事件类型与可选参数。
 * 允许发送任何 JSON.stringify() 支持的 JS 对象。
 * 暂不支持发送函数。
 * 保留旧的 'send' 方法用于 'message' 事件。
 */
class EventChannel extends ChannelSuper {
    /**
     * 在 Node 侧触发一个自定义事件
     * @param event 事件名
     * @param message 消息内容，支持多个参数
     */
    post(event, ...msg) {
        RNNodeJsMobile.sendMessage(this.name, MessageCodec.serialize(event, ...msg))
    }

    /**
     * 触发 `'message'` 事件，是 `post('message', ...)` 的别名
     * @param message 消息内容，支持多个参数
     */
    send(...msg) {
        this.post('message', ...msg)
    }

    /**
     * 处理从 Node 侧送达的通道消息（内部方法）
     * - 反序列化消息信封，取出事件名与负载
     * - 在本地触发对应事件，事件只在本作用域生效，不会回传到 Node 侧
     * @param data 序列化后的消息信封字符串（由原生代码经通道分发到此）
     */
    processData(data) {
        const envelope = MessageCodec.deserialize(data)
        this.emitLocal(envelope.event, ...(envelope.payload))
    }
}
/**
 * 注册通道到全局字典
 */
const registerChannel = channel => channels[channel.name] = channel;
/**
 * 从 nodejs-project 目录下的某个文件启动 nodejs-mobile 运行时线程
 * > 查看定义:@see {@link start}
 * @param scriptFileName 脚本文件名（相对 nodejs-project 目录）
 * @param options 启动选项
 */
const start = (mainFileName, options = {}) => {
    if (typeof mainFileName !== 'string')
        throw new Error('@flun/nodejs-mobile-react-native 的 start 需要传入 main .js 入口文件名,例如：nodejs.start("main.js")');

    RNNodeJsMobile.startNodeProject(mainFileName, options)
}
/**
 * 从 nodejs-project 目录下的某个文件启动运行时线程,并传入额外参数
 * > 查看定义：{@link startWithArgs}
 * @param command 完整命令行（通常脚本文件名作为第一个参数）
 * @param options 启动选项
 */
const startWithArgs = (command, options = {}) => {
    if (typeof command !== 'string')
        throw new Error(`@flun/nodejs-mobile-react-native 的 startWithArgs 需要传入 main .js 入口文件名与可选参数;
      例如：nodejs.startWithArgs("main.js -c custom")`);

    RNNodeJsMobile.startNodeProjectWithArgs(command, options)
}
/**
 * 用一个脚本字符串启动 nodejs-mobile 运行时线程
 * > 查看定义：{@link startWithScript}
 * @param scriptBody 脚本内容
 * @param options 启动选项
 */
const startWithScript = (script, options = {}) => RNNodeJsMobile.startNodeWithScript(script, options);

/**
 * 与 Node 侧双向通信的事件通道
 * > 查看定义：{@link channel}
 */
const channel = new EventChannel('_EVENTS_')
registerChannel(channel);

/*
 * 所有通道的分发器。该事件由插件的原生代码调用,
 * 把来自 Node 的事件送达此处。
 * channelName 字段是通道名。
 * message 字段是数据。
 */
NativeAppEventEmitter.addListener('nodejs-mobile-react-native-message', e => {
    if (channels[e.channelName]) channels[e.channelName].processData(e.message)
    else throw new Error(`通道未找到: ${e.channelName}`)
});

export { start, startWithArgs, startWithScript, channel };