// QQ 群(Group)相关 API：群信息/列表、群成员、踢人、禁言、入群审批、自动审批策略
// 所有方法在 Bot 原型上以 this 调用，依赖 this.request / this.config

// 获取群信息
async function getGroupInfo(group_id) {
  const { data } = await this.request.get(`/v2/groups/${group_id}/info`)
  return data
}

// 获取群列表
async function getGroupList() {
  const _getGroupList = async (after = undefined) => {
    const res = await this.request.get('/users/@me/groups', { params: { after } }).catch(() => ({ data: [] }))
    if (!res.data?.length) return []
    const result = res.data
    const last = result[result.length - 1]
    return [...result, ...await _getGroupList(last.guild_id)]
  }
  return await _getGroupList()
}

// 获取群内bot状态
async function getGroupBotInfo(group_id) {
  const { data } = await this.request.get(`/v2/groups/${group_id}/bot_state`)
  return data
}

// 获取群成员列表
async function getGroupMemberList(group_id, cursor = undefined) {
  const getGroupMemberList = async (cursor = undefined) => {
    const res = await this.request.get(`/v2/groups/${group_id}/members`, {
      params: { cursor, limit: 100 },
    }).catch(() => ({ data: { members: [], next_cursor: cursor } }))
    const { members = [], next_cursor } = res.data
    if (members.length === 0 && next_cursor === cursor) return [{ next_cursor, error:true }]
    if (!next_cursor || next_cursor === cursor) return members
    return [...members, ...await getGroupMemberList(next_cursor)]
  }
  return await getGroupMemberList(cursor)
}

// 获取群成员信息
async function getGroupMemberInfo(group_id, member_id) {
  const { data } = await this.request.get(`/v2/groups/${group_id}/members/${member_id}`)
  return {
    openid: data.member_openid,
    unionid: data.union_openid,
    avatar: `https://q.qlogo.cn/qqapp/${this.config.appid}/${data.member_openid}/0`,
    card: data.username,
    nickname: data.username,
    join_time: new Date(data.joined_at).getTime() / 1000,
    role: data.member_role,
    bot: data.bot,
  }
}

// 踢出群成员
async function kickGroupMembers(group_id, member_openids, add_to_member_blacklist = false) {
  if (member_openids.length > 20) {
    throw new Error(`member_openids最多可添加20个`)
  }
  const result = await this.request.post(`/v2/groups/${group_id}/batch_remove_members`,{
    member_openids,
    add_to_member_blacklist,
  })
  return result.status === 204
}

// 群黑名单查询
async function getGroupMemberBlackList(group_id) {
  const _getGroupMemberBlackList = async (cursor = undefined) => {
    const res = await this.request.get(`/v2/groups/${group_id}/member_blacklist`, {
      params: { cursor, limit: 100 },
    }).catch(() => ({ data: { users: [], next_cursor: undefined } }))
    const { users = [], next_cursor } = res.data
    if (!next_cursor || next_cursor === cursor) return users
    return [...users, ...await _getGroupMemberBlackList(next_cursor)]
  }
  return _getGroupMemberBlackList()
}

// 群黑名单操作 data:{op: 'add|del', fail_openids: ['1234567890']}
async function changeGroupMemberBlackList(group_id, op, member_openids) {
  if (!['add', 'del'].includes(op)) {
    throw new Error(`op参数必须为add|del，当前为${op}`)
  }
  if (member_openids.length > 20) {
    throw new Error(`member_openids最多可操作20个`)
  }
  const { data } = await this.request.post(`/v2/groups/${group_id}/member_blacklist`, {
    op,
    member_openids,
  })
  data.op = op
  return data
}

// 禁言群成员 2026.9.3 接口限制10个修改为20个
async function muteGroupMember(group_id, op, memberlist, end_time = '') {
  if (!['add', 'update', 'del'].includes(op)) {
    throw new Error(`op参数必须为add|update|del，当前为${op}`)
  }
  if (memberlist.length > 20) {
    throw new Error(`禁言接口最多一次可操作20个`)
  }
  let members = []
  for (const member of memberlist) {
    members.push({ op, member_openid: member, mute_expire_at: `${end_time}` })
  }
  const result = await this.request.post(`/v2/groups/${group_id}/restrict_chat_setting`, { members })
  return result.status === 200
}

// 获取群内禁言状态
async function getGroupmuteState(group_id) {
  const { data } = await this.request.get(`/v2/groups/${group_id}/restrict_chat_setting`)
  return data
}

// 入群申请审批
async function approvalGroupRequest(group_id, member_id, op, join_request_id = '', reject_reason = '', add_to_member_blacklist = false) {
  const result = await this.request.post(`/v2/groups/${group_id}/approval_join_request/${member_id}`, {
    op,
    join_request_id,
    reject_reason,
    add_to_member_blacklist,
  })
  return result.status === 200
}

// 入群申请列表 // 2026.9.3 接口limit限制从100减少到50
async function getGroupRequestList(group_id) {
  const _getGroupRequestList = async (cursor = undefined) => {
    const res = await this.request.get(`/v2/groups/${group_id}/join_request_list`, {
      params: { cursor, limit: 50 },
    }).catch(() => ({ data: [] }))
    const { list = [], next_cursor } = res.data
    if (!next_cursor || next_cursor === cursor) return list
    return [...list, ...await _getGroupRequestList(next_cursor)]
  }
  return _getGroupRequestList()
}

// 获取自动审批策略列表 2026.9.3 接口limit限制从100减少到50
async function getAutoApproveList() {
  const _getAutoApproveList = async (cursor = undefined) => {
    const { data } = await this.request.get(`/v2/groups/join_approval_strategy`, {
      params: { cursor, limit: 50 },
    })
    const strategies = data.strategies
    if (!data.next_cursor) return strategies
    return [...strategies, ...await _getAutoApproveList(data.next_cursor)]
  }
  return await _getAutoApproveList()
}

// 创建自动审批策略
async function createAutoApprove(group_openids, group_ids, is_enable, expire_at, remark) {
  if (group_openids.length > 100 || group_ids.length > 100) {
    throw new Error(`group_openids和group_ids最多可添加100个`)
  }
  if (!['on', 'off'].includes(is_enable)) {
    throw new Error(`is_enable参数必须为on|off,当前：${is_enable}`)
  }
  if (group_openids.length > 0 && group_ids.length > 0) {
    throw new Error(`group_openids 与 group_ids 二选一必填`)
  }
  if (group_openids.length === 0 && group_ids.length === 0) {
    throw new Error(`group_openids 与 group_ids 二选一必填`)
  }
  const { data } = await this.request.post(`/v2/groups/join_approval_strategy`, {
    group_openids,
    group_ids,
    is_enable,
    expire_at,
    remark,
  })
  return data
}

// 修改自动审批策略
async function changeAutoApprove(strategy_id, is_enable, expire_at, group_action, remark) {
  if (!strategy_id) throw new Error(`strategy_id参数必填`)
  if (!['on', 'off'].includes(is_enable)) throw new Error(`is_enable参数必须为on|off,当前：${is_enable}`)
  if (group_action.group_openids?.length > 0 && group_action.group_ids?.length > 0) {
    throw new Error(`group_openids 与 group_ids 二选一必填`)
  }
  if (group_action.group_openids?.length === 0 && group_action.group_ids?.length === 0) {
    throw new Error(`group_openids 与 group_ids 二选一必填`)
  }
  const { data } = await this.request.put(`/v2/groups/join_approval_strategy/{strategy_id}`, {
    strategy_id,
    is_enable,
    expire_at,
    group_action,
    remark,
  })
  return data
}

// 删除自动审批策略
async function deleteAutoApprove(strategy_id) {
  if (!strategy_id) throw new Error(`strategy_id参数必填`)
  const result = await this.request.delete(`/v2/groups/join_approval_strategy/${strategy_id}`)
  return result.status === 204
}

// 执行自动审批策略
async function execAutoApprove(strategy_id) {
  if (!strategy_id) throw new Error(`strategy_id参数必填`)
  const { data } = await this.request.post(`/v2/groups/join_approval_strategy/${strategy_id}/execute`)
  return data
}

// 修改自动审批策略白名单号码
async function changeWhitelistOfAutoApprove(strategy_id, op, whitelist_users) {
  if (!strategy_id) throw new Error(`strategy_id参数必填`)
  if (!['add', 'del'].includes(op)) throw new Error(`op参数必须为add|del,当前：${op}`)
  if (whitelist_users.length > 100) throw new Error(`whitelist_users最多可添加10000个`)
  const { data } = await this.request.put(`/v2/groups/join_approval_strategy/${strategy_id}/whitelist_users`, {
    op,
    whitelist_users,
  })
  return data
}

module.exports = {
  getGroupInfo,
  getGroupList,
  getGroupBotInfo,
  getGroupMemberList,
  getGroupMemberInfo,
  kickGroupMembers,
  getGroupMemberBlackList,
  changeGroupMemberBlackList,
  muteGroupMember,
  getGroupmuteState,
  approvalGroupRequest,
  getGroupRequestList,
  getAutoApproveList,
  createAutoApprove,
  changeAutoApprove,
  deleteAutoApprove,
  execAutoApprove,
  changeWhitelistOfAutoApprove,
}
