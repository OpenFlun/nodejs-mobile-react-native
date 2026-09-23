const EventEmitter = require('events');
const NativeBridge = process._linkedBinding('rn_bridge');

/**
 * 内置事件通道：在 react-native 应用与 Node.js 应用之间交换事件。
 * 支持用户自定义事件类型与可选参数。
 */
const EVENT_CHANNEL = '_EVENTS_';

/**
 * 内置单向事件通道，保留用于从 react-native 插件原生层向 Node.js 应用发送事件。
 */
const SYSTEM_CHANNEL = '_SYSTEM_';

/**
 * 本类也在插件的根 index.js 中定义。
 * 任何修改都应同步到根 index.js。
 * MessageCodec 提供两个静态方法，用于序列化 / 反序列化通过事件通道发送的数据。
 */
class MessageCodec {
  // 私有构造，仅由本类的静态方法使用
  constructor(_event, ..._payload) {
    this.event = _event;
    this.payload = JSON.stringify(_payload);
  }

  // 序列化事件名与负载
  static serialize(event, ...payload) {
    const envelope = new MessageCodec(event, ...payload);
    // 返回可经通道发送的序列化消息
    return JSON.stringify(envelope);
  }

  // 反序列化事件名与负载
  static deserialize(message) {
    const envelope = JSON.parse(message);
    if (typeof envelope.payload !== 'undefined') {
      envelope.payload = JSON.parse(envelope.payload);
    }
    return envelope;
  }
}

/**
 * Channel 父类。
 */
class ChannelSuper extends EventEmitter {
  constructor(name) {
    super();
    this.name = name;
    // 把 'emit' 改名为 'emitLocal' 不是必须的，但能明确：
    // 在该对象上"emit"只有本地作用域——事件只在 react-native 侧触发，不会发送到 Node。
    this.emitLocal = this.emit;
    delete this.emit;
  }

  emitWrapper(type, ...msg) {
    const _this = this;
    setImmediate(() => {
      _this.emitLocal(type, ...msg);
    });
  }
}

/**
 * 事件通道类：支持用户自定义事件类型与可选参数。
 * 允许发送任何 JSON.stringify() 支持的 JS 对象。
 * 暂不支持发送函数。
 * 保留旧的 'send' 方法用于 'message' 事件。
 */
class EventChannel extends ChannelSuper {
  post(event, ...msg) {
    NativeBridge.sendMessage(this.name, MessageCodec.serialize(event, ...msg));
  }

  // 发送 'message' 事件，兼容旧代码。
  send(...msg) {
    this.post('message', ...msg);
  }

  processData(data) {
    // data 中是序列化后的消息信封
    const envelope = MessageCodec.deserialize(data);
    this.emitWrapper(envelope.event, ...(envelope.payload));
  }
}

/**
 * System 事件锁类
 * 辅助类，用于在 system 事件处理器中管理锁的获取与释放。
 * 所有锁释放后会调用回调。
 */
class SystemEventLock {
  constructor(callback, startingLocks) {
    this._locksAcquired = startingLocks; // 初始锁数量
    this._callback = callback; // 所有锁释放后调用的回调
    this._hasReleased = false; // 释放后不再做任何事
    this._checkRelease(); // 初始检查：若无锁，立即释放
  }
  // 释放一个锁；若所有锁已释放，调用回调。
  release() {
    if (this._hasReleased) return;
    this._locksAcquired--;
    this._checkRelease();
  }
  // 检查是否可以释放锁并释放。
  _checkRelease() {
    if (this._locksAcquired <= 0) {
      this._hasReleased = true;
      this._callback();
    }
  }
}

/**
 * System 通道类。
 * 当应用进入后台/前台时发出 pause/resume 事件。
 */
class SystemChannel extends ChannelSuper {
  constructor(name) {
    super(name);
    // datadir 在运行时不应变化，因此缓存它。
    this._cacheDataDir = null;
  }

  emitWrapper(type) {
    // 重载 emitWrapper 以处理 pause 事件的锁。
    const _this = this;
    if (type.startsWith('pause')) {
      setImmediate(() => {
        let releaseMessage = 'release-pause-event';
        const eventArguments = type.split('|');
        if (eventArguments.length >= 2) {
          // 释放消息的预期格式为 "release-pause-event|{eventId}"
          // eventId 来自 pause 事件，格式为 "pause|{eventId}"
          releaseMessage = releaseMessage + '|' + eventArguments[1];
        }
        // 创建锁，在应用事件处理完成后通知原生侧。
        const eventLock = new SystemEventLock(
          () => {
            NativeBridge.sendMessage(_this.name, releaseMessage);
          },
          _this.listenerCount("pause") // 为每个当前事件监听器加锁，所有监听器都需调用 release()
        );
        _this.emitLocal("pause", eventLock);
      });
    } else {
      setImmediate(() => {
        _this.emitLocal(type);
      });
    }
  }

  processData(data) {
    // data 就是事件
    this.emitWrapper(data);
  }

  // 获取可写的持久化文件存储目录。
  datadir() {
    if (this._cacheDataDir === null) {
      this._cacheDataDir = NativeBridge.getDataDir();
    }
    return this._cacheDataDir;
  }
}

/**
 * 管理已注册的通道，用于发出 react-native 应用或插件自身（即 system 通道）收到的事件/消息。
 */
const channels = {};

/*
 * 原生代码收到来自 react-native 应用的事件/消息时调用本方法。
 */
function bridgeListener(channelName, data) {
  if (channels.hasOwnProperty(channelName)) {
    channels[channelName].processData(data);
  } else {
    console.error('错误: 未找到通道:', channelName);
  }
}

/*
 * 桥接原生代码为每个通道维护独立的消息队列，
 * 因此每个通道都需要在原生代码中注册。
 */
function registerChannel(channel) {
  channels[channel.name] = channel;
  NativeBridge.registerChannel(channel.name, bridgeListener);
}

/**
 * 模块导出。
 */
const systemChannel = new SystemChannel(SYSTEM_CHANNEL);
registerChannel(systemChannel);

// 通知原生代码我们已准备好接收应用事件，避免 Node 就绪前原生代码加锁。
NativeBridge.sendMessage(SYSTEM_CHANNEL, "ready-for-app-events");

const eventChannel = new EventChannel(EVENT_CHANNEL);
registerChannel(eventChannel);

module.exports = exports = {
  app: systemChannel,
  channel: eventChannel
};
