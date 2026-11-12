// 好友(Friend)相关 API：机器人自身信息、好友列表、私聊输入状态
// 所有方法在 Bot 原型上以 this 调用，依赖 this.request
// 注：私聊消息收发(C2C)相关接口在 ./message
const { UnsupportedMethodError } = require("../constans")

// 获取机器人信息
async function getSelfInfo() {
  const { data: result } = await this.request.get('/users/@me')
  return result
}

// 获取好友列表（暂未支持）
async function getFriendList() {
  const _getFriendList = async (cursor = undefined) => {
    const res = await this.request.get('/users/@me/users', { params: { cursor } }).catch(() => ({ data: [] }))
    const { list = [], next_cursor } = res.data
    if (!next_cursor || next_cursor === cursor) return list
    return [...list, ...await _getFriendList(next_cursor)]
  }
  return await _getFriendList()
}

// 获取好友信息（暂未支持）
// @param friend_id
async function getFriendInfo(friend_id) {
  throw UnsupportedMethodError
}

// 设置私聊输入状态（会话状态控制，归属好友会话域）
// @param input_type 1-正在输入
// @param input_second 持续秒数
// @param msg_id 原消息id，用于持续输入状态刷新
async function sendFriendInputNotify(user_id, input_type, input_second, msg_id) {
  const result = await this.request.post(`/v2/users/${user_id}/messages`, { msg_type: 6, input_notify: { input_type, input_second }, msg_id })
  return result.data?.ext_info || { ref_idx: '' }
}

module.exports = {
  getSelfInfo,
  getFriendList,
  getFriendInfo,
  sendFriendInputNotify,
}
