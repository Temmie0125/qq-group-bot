// 消息(Message)相关 API：私聊/群/频道/频道私信收发、撤回
// 所有方法在 Bot 原型上以 this 调用，依赖 this.request / this.Sender / this.processMessage / this.processPayload
const { Sender } = require('./sender')

// 流式消息相关常量
const StreamInputMode = { REPLACE: 'replace' }
const StreamInputState = { GENERATING: 1, DONE: 10 }
const StreamContentType = { MARKDOWN: 'markdown' }

// 发送私聊消息
async function sendPrivateMessage(user_id, message, source, options = {}) {
  if (options.stream) {
    try {
      let content = await this.processMessage(message)
      if (!content) throw new Error('内容解析失败')
      const result = await this.sendPrivateStreamMessage(user_id, content, source, options)
      return result
    } catch (e) {
      this.logger.error(`流式失败发送消息,转为普通消息`)
      this.logger.info(message)
      const sender = new Sender(this, `/v2/users/${user_id}`, message, source)
      const result = await sender.sendMsg()
      this.logger.info(`send to User(${user_id}): ${sender.brief}`)
      return result
    }
  }
  const sender = new Sender(this, `/v2/users/${user_id}`, message, source)
  const result = await sender.sendMsg()
  this.logger.info(`send to User(${user_id}): ${sender.brief}`)
  return result
}

// 发送私聊流式消息
async function sendPrivateStreamMessage(user_id, message, source, options = {}) {
  let chunkSize = options.chunkSize || Math.ceil(message.length / 2)
  const delay = options.delay || 100
  this.logger.info(`开始发送流式私聊消息到用户(${user_id}), 总长度: ${message.length}字符`)
  let streamMsgId = null
  let index = 0
  let currentContent = ''
  try {
    for (let i = 0; i < message.length; i += chunkSize) {
      const chunk = message.substring(i, i + chunkSize)
      currentContent += chunk
      const req = {
        input_mode: StreamInputMode.REPLACE,
        input_state: i + chunkSize >= message.length ? StreamInputState.DONE : StreamInputState.GENERATING,
        content_type: StreamContentType.MARKDOWN,
        content_raw: currentContent,
        event_id: source?.event_id || `event_${Date.now()}`,
        msg_id: source?.id || `msg_${Date.now()}`,
        index: index++,
      }
      if (streamMsgId) req.stream_msg_id = streamMsgId
      const response = await this.request.post(`/v2/users/${user_id}/stream_messages`, req)
      if (!streamMsgId && response.data && response.data.id) streamMsgId = response.data.id
      this.logger.debug(`发送分片 ${index}/${Math.ceil(message.length / chunkSize)}: ${currentContent.length}字符`)
      if (i + chunkSize < message.length) await new Promise(resolve => setTimeout(resolve, delay))
    }
    this.logger.info(`流式私聊消息发送完成: ${currentContent.length}字符`)
    return { id: streamMsgId, content: currentContent }
  } catch (error) {
    this.logger.error(`流式消息发送失败: ${error.message}`)
    throw error
  }
}

// 撤回私聊消息
async function recallPrivateMessage(user_id, message_id) {
  const result = await this.request.delete(`/v2/users/${user_id}/messages/${message_id}`)
  return result.status === 200
}

// 发送群消息
async function sendGroupMessage(group_id, message, source) {
  const sender = new Sender(this, `/v2/groups/${group_id}`, message, source)
  const result = await sender.sendMsg()
  this.logger.info(`send to Group(${group_id}): ${sender.brief}`)
  return result
}

// 撤回群消息
async function recallGroupMessage(group_id, message_id) {
  const result = await this.request.delete(`/v2/groups/${group_id}/messages/${message_id}`)
  return result.status === 200
}

// 发送频道消息
async function sendGuildMessage(channel_id, message, source) {
  const sender = new Sender(this, `/channels/${channel_id}`, message, source)
  const result = await sender.sendMsg()
  this.logger.info(`send to Channel(${channel_id}/messages): ${sender.brief}`)
  return result
}

// 撤回频道消息
async function recallGuildMessage(channel_id, message_id, hidetip) {
  const result = await this.request.delete(`/channels/${channel_id}/messages/${message_id}?hidetip=${!!hidetip}`)
  return result.status === 200
}

// 获取频道消息
async function getGuildMessage(channel_id, message_id) {
  const { data: payload } = await this.request.get(`/channels/${channel_id}/messages/${message_id}`)
  return this.processPayload(payload.id, `message.guild`, payload)
}

// 发送频道私信
async function sendDirectMessage(guild_id, message, source) {
  const sender = new Sender(this, `/dms/${guild_id}`, message, source)
  const result = await sender.sendMsg()
  this.logger.info(`send to Direct(${guild_id}): ${sender.brief}`)
  return result
}

// 获取频道私信
async function getDirectMessage(guild_id, message_id) {
  const { data: payload } = await this.request.get(`/dms/${guild_id}/messages/${message_id}`)
  return this.processPayload(payload.id, `message.direct`, payload)
}

// 撤回频道私信
async function recallDirectMessage(guild_id, message_id, hidetip) {
  const result = await this.request.delete(`/dms/${guild_id}/messages/${message_id}?hidetip=${!!hidetip}`)
  return result.status === 200
}

// 注：uploadMedia 由父类 QQBot(lib/qqBot.js) 提供，此处不重复挂载，保持与原包一致

module.exports = {
  sendPrivateMessage,
  sendPrivateStreamMessage,
  recallPrivateMessage,
  sendGroupMessage,
  recallGroupMessage,
  sendGuildMessage,
  recallGuildMessage,
  getGuildMessage,
  sendDirectMessage,
  getDirectMessage,
  recallDirectMessage,
}
