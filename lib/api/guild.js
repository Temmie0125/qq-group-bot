// 频道(Guild)相关 API：频道信息、角色、权限、禁言、成员、踢人、公告、API 申请
// 所有方法在 Bot 原型上以 this 调用，依赖 this.request / this.config / this.logger

// 获取频道角色权限信息
async function getChannelPermissionOfRole(channel_id, role_id) {
  const { data: result } = await this.request.get(`/channels/${channel_id}/roles/${role_id}/permissions`)
  return result
}

// 设置频道公告
async function setChannelAnnounce(guild_id, channel_id, message_id) {
  const { data: result } = await this.request.post(`/guilds/${guild_id}/announces`, {
    message_id,
    channel_id,
  })
  return result
}

// 更新频道角色权限
async function updateChannelPermissionOfRole(channel_id, role_id, permission) {
  const result = await this.request.put(`/channels/${channel_id}/roles/${role_id}/permissions`, permission)
  return result.status === 204
}

// 获取频道用户权限
async function getChannelMemberPermission(channel_id, member_id) {
  const { data: result } = await this.request.get(`/channels/${channel_id}/members/${member_id}/permissions`)
  return result
}

// 更新频道用户权限
async function updateChannelMemberPermission(channel_id, member_id, permission) {
  const result = await this.request.put(`/channels/${channel_id}/members/${member_id}/permissions`, permission)
  return result.status === 204
}

// 获取频道置顶消息id列表
async function getChannelPins(channel_id) {
  const { data: { message_ids = [] } = {} } = await this.request.get(`/channels/${channel_id}/pins`)
  return message_ids
}

// 置顶频道消息
async function pinChannelMessage(channel_id, message_id) {
  const { data: result } = await this.request.post(`/channels/${channel_id}/pins/${message_id}`)
  return result
}

// 取消置顶频道消息
async function unPinChannelMessage(channel_id, message_id) {
  const result = await this.request.delete(`/channels/${channel_id}/pins/${message_id}`)
  return result.status === 204
}

// 获取频道角色列表
async function getGuildRoles(guild_id) {
  const { data: { roles = [] } = {} } = await this.request.get(`/guilds/${guild_id}/roles`)
  return roles
}

// 创建频道角色
async function creatGuildRole(guild_id, role) {
  const { data: result } = await this.request.post(`/guilds/${guild_id}/roles`, role)
  return result.role
}

// 修改频道角色
async function updateGuildRole(guild_id, role_id, updateInfo) {
  const { data: result } = await this.request.patch(`/guilds/${guild_id}/roles/${role_id}`, updateInfo)
  return result.role
}

// 删除频道角色
async function deleteGuildRole(role_id) {
  const result = await this.request.delete(`/guilds/{guild_id}/roles/${role_id}`)
  return result.status === 204
}

// 获取频道可访问API类别
async function getGuildAccessApis(guild_id) {
  const { data: result } = await this.request.get(`/guilds/${guild_id}/api_permission`)
  return result.apis || []
}

// 申请频道API
async function applyGuildAccess(guild_id, channel_id, apiInfo, desc) {
  const { data: result } = await this.request.post(`/guilds/${guild_id}/api_permission/demand`, {
    channel_id,
    api_identify: apiInfo,
    desc,
  })
  return result
}

// 取消频道禁言
async function unMuteGuild(guild_id) {
  return this.muteGuild(guild_id, 0, 0)
}

// 频道禁言
async function muteGuild(guild_id, seconds, end_time) {
  const result = await this.request.put(`/guilds/${guild_id}/mute`, {
    mute_seconds: `${seconds}`,
    mute_end_timestamp: `${end_time}`,
  })
  return result.status === 204
}

// 批量取消频道成员禁言
async function unMuteGuildMembers(guild_id, member_ids) {
  return this.muteGuildMembers(guild_id, member_ids, 0, 0)
}

// 批量禁言频道成员
async function muteGuildMembers(guild_id, member_ids, seconds, end_time) {
  const result = await this.request.put(`/guilds/${guild_id}/mute`, {
    mute_seconds: `${seconds}`,
    mute_end_timestamp: `${end_time}`,
    user_ids: member_ids,
  })
  return result.status === 200
}

// 添加频道成员角色
async function addGuildMemberRoles(guild_id, channel_id, member_id, role_id) {
  const result = await this.request.put(`/guilds/${guild_id}/members/${member_id}/roles/${role_id}`, { id: channel_id })
  return result.status === 204
}

// 移除频道成员角色
async function removeGuildMemberRoles(guild_id, channel_id, member_id, role_id) {
  const result = await this.request.delete(`/guilds/${guild_id}/members/${member_id}/roles/${role_id}`, { data: { id: channel_id } })
  return result.status === 204
}

// 踢出频道成员
async function kickGuildMember(guild_id, member_id, clean = 0, blacklist) {
  const result = await this.request.delete(`/guilds/${guild_id}/members/${member_id}`, {
    data: {
      add_blacklist: blacklist,
      delete_message_days: clean,
    },
  })
  return result.status === 204
}

// 取消频道成员禁言
async function unMuteGuildMember(guild_id, member_id) {
  return this.muteGuildMember(guild_id, member_id, 0, 0)
}

// 禁言频道成员
async function muteGuildMember(guild_id, member_id, seconds, end_time) {
  const result = await this.request.put(`/guilds/${guild_id}/members/${member_id}/mute`, {
    mute_seconds: `${seconds}`,
    mute_end_timestamp: `${end_time}`,
  })
  return result.status === 204
}

// 获取频道列表
async function getGuildList() {
  const _getGuildList = async (after = undefined) => {
    const res = await this.request.get('/users/@me/guilds', {
      params: { after },
    }).catch(() => ({ data: [] })) // 私域不支持获取频道列表，做个兼容
    if (!res.data?.length) return []
    const result = (res.data || []).map(g => {
      const { id: guild_id, name: guild_name, joined_at, ...guild } = g
      return { guild_id, guild_name, join_time: new Date(joined_at).getTime() / 1000, ...guild }
    })
    const last = result[result.length - 1]
    return [...result, ...await _getGuildList(last.guild_id)]
  }
  return await _getGuildList()
}

// 获取频道信息
async function getGuildInfo(guild_id) {
  const { data: { id: _, name: guild_name, joined_at, ...guild } } = await this.request.get(`/guilds/${guild_id}`)
  return { guild_id, guild_name, join_time: new Date(joined_at).getTime() / 1000, ...guild }
}

// 获取频道成员列表
async function getGuildMemberList(guild_id) {
  const _getGuildMemberList = async (after = undefined) => {
    const res = await this.request.get(`/guilds/${guild_id}/members`, {
      params: { after, limit: 100 },
    }).catch(() => ({ data: [] })) // 公域没有权限，做个兼容
    if (!res.data?.length) return []
    const result = (res.data || []).map(m => {
      const { user: { id: member_id, ...member }, roles, joined_at, nick } = m
      return { member_id, card: nick, roles, ...member, join_time: new Date(joined_at).getTime() / 1000 }
    })
    const last = result[result.length - 1]
    return [...result, ...await _getGuildMemberList(last.member_id)]
  }
  return await _getGuildMemberList()
}

// 获取频道成员信息
async function getGuildMemberInfo(guild_id, member_id) {
  const { data: { user: { id: _, ...member }, roles, joined_at, nick } } = await this.request.get(`/guilds/${guild_id}/members/${member_id}`)
  return { member_id, card: nick, roles, ...member, join_time: new Date(joined_at).getTime() / 1000 }
}

module.exports = {
  getChannelPermissionOfRole,
  setChannelAnnounce,
  updateChannelPermissionOfRole,
  getChannelMemberPermission,
  updateChannelMemberPermission,
  getChannelPins,
  pinChannelMessage,
  unPinChannelMessage,
  getGuildRoles,
  creatGuildRole,
  updateGuildRole,
  deleteGuildRole,
  getGuildAccessApis,
  applyGuildAccess,
  unMuteGuild,
  muteGuild,
  unMuteGuildMembers,
  muteGuildMembers,
  addGuildMemberRoles,
  removeGuildMemberRoles,
  kickGuildMember,
  unMuteGuildMember,
  muteGuildMember,
  getGuildList,
  getGuildInfo,
  getGuildMemberList,
  getGuildMemberInfo,
}
