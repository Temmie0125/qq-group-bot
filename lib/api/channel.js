// 子频道(Channel)相关 API：子频道 CRUD、置顶、权限、日程、音频、帖子、表态
// 所有方法在 Bot 原型上以 this 调用，依赖 this.request

// 创建子频道
async function createChannel(guild_id, channelInfo) {
  const { data: result } = await this.request.post(`/guilds/${guild_id}/channels`, channelInfo)
  return result
}

// 修改子频道
async function updateChannel(channel_id, updateInfo) {
  const { data: result } = await this.request.patch(`/channels/${channel_id}`, updateInfo)
  return result
}

// 删除子频道
async function deleteChannel(channel_id) {
  const result = await this.request.delete(`/channels/${channel_id}`)
  return result.status === 200
}

// 获取子频道列表
async function getChannelList(guild_id) {
  const { data: result = [] } = await this.request.get(`/guilds/${guild_id}/channels`)
  return result.map(({ id: channel_id, name: channel_name, ...channel }) => ({ channel_id, channel_name, ...channel }))
}

// 获取子频道信息
async function getChannelInfo(channel_id) {
  const { data: { id: _, name: channel_name, ...channel } } = await this.request.get(`/channels/${channel_id}`)
  return { channel_id, channel_name, ...channel }
}

// 对频道消息进行表态
async function reactionGuildMessage(channel_id, message_id, type, id) {
  const result = await this.request.put(`/channels/${channel_id}/messages/${message_id}/reactions/${type}/${id}`)
  return result.status === 200
}

// 删除频道消息表态
async function deleteGuildMessageReaction(channel_id, message_id, type, id) {
  const result = await this.request.delete(`/channels/${channel_id}/messages/${message_id}/reactions/${type}/${id}`)
  return result.status === 204
}

// 获取表态用户列表
async function getGuildMessageReactionMembers(channel_id, message_id, type, id) {
  const formatUser = (users) => users.map(user => ({ user_id: user.id, user_name: user.username, avatar: user.avatar }))
  const getMembers = async (cookies) => {
    const { data: { users, cookie, is_end } } = await this.request.get(`/channels/${channel_id}/messages/${message_id}/reactions/${type}/${id}`, {
      params: { cookie: cookies },
    })
    if (is_end) return formatUser(users)
    return [...formatUser(users), ...await getMembers(cookie)]
  }
  return await getMembers()
}

// 获取频道日程
async function getChannelSchedules(channel_id, since) {
  const { data } = await this.request.get(`/channels/${channel_id}/schedules`, { params: { since } })
  return data
}

// 获取日程详情
async function getChannelScheduleInfo(channel_id, schedule_id) {
  const { data } = await this.request.get(`/channels/${channel_id}/schedules/${schedule_id}`)
  return data
}

// 创建日程
async function createChannelSchedule(channel_id, schedule) {
  const { data } = await this.request.post(`/channels/${channel_id}/schedules`, schedule)
  return data
}

// 修改日程
async function updateChannelSchedule(channel_id, schedule_id, schedule) {
  const { data } = await this.request.patch(`/channels/${channel_id}/schedules/${schedule_id}`, schedule)
  return data
}

// 删除日程
async function deleteChannelSchedule(channel_id, schedule_id) {
  const { data } = await this.request.delete(`/channels/${channel_id}/schedules/${schedule_id}`)
  return data
}

// 音频控制
async function controlChannelAudio(channel_id, audio_control) {
  const result = await this.request.post(`/channels/${channel_id}/audio`, audio_control)
  return result.status === 200
}

// 上麦
async function setOnlineMic(channel_id) {
  const result = await this.request.put(`/channels/${channel_id}/mic`)
  return result.status === 200
}

// 下麦
async function setOfflineMic(channel_id) {
  const result = await this.request.delete(`/channels/${channel_id}/mic`)
  return result.status === 204
}

// 获取频道帖子列表
async function getChannelThreads(channel_id) {
  const { data } = await this.request.get(`/channels/${channel_id}/threads`)
  return data
}

// 获取频道帖子详情
async function getChannelThreadInfo(channel_id, thread_id) {
  const { data } = await this.request.get(`/channels/${channel_id}/threads/${thread_id}`)
  return data
}

// 创建频道帖子
async function publishThread(channel_id, title, content, format = 3) {
  const { data } = await this.request.post(`/channels/${channel_id}/threads`, { title, content, format })
  return data
}

// 删除频道帖子
async function deleteThread(channel_id, thread_id) {
  const result = await this.request.delete(`/channels/${channel_id}/threads/${thread_id}`)
  return result.status === 204
}

module.exports = {
  createChannel,
  updateChannel,
  deleteChannel,
  getChannelList,
  getChannelInfo,
  reactionGuildMessage,
  deleteGuildMessageReaction,
  getGuildMessageReactionMembers,
  getChannelSchedules,
  getChannelScheduleInfo,
  createChannelSchedule,
  updateChannelSchedule,
  deleteChannelSchedule,
  controlChannelAudio,
  setOnlineMic,
  setOfflineMic,
  getChannelThreads,
  getChannelThreadInfo,
  publishThread,
  deleteThread,
}
