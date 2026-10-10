// 交互(Interaction)与私信会话相关 API：按钮回应、私信会话创建、分享链接生成
// 所有方法在 Bot 原型上以 this 调用，依赖 this.request

// 回应操作
async function replyAction(action_id, code = 0, opt = {}) {
  const result = await this.request.put(`/interactions/${action_id}`, { code, ...opt })
  return result.status === 200
}

// 创建私信会话
async function createDirectSession(guild_id, user_id) {
  const { data: result } = await this.request.post(`/users/@me/dms`, {
    recipient_id: user_id,
    source_guild_id: guild_id,
  })
  return { ...result, create_time: new Date(result.create_time).getTime() / 1000 }
}

// 获取机器人分享链接
async function getGenerateUrl(callback_data) {
  const result = await this.request.post('/v2/generate_url_link', { callback_data })
  return result.data.data.url
}

module.exports = {
  replyAction,
  createDirectSession,
  getGenerateUrl,
}
