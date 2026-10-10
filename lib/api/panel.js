// 自定义菜单与指令面板(Panel)相关 API
// 所有方法在 Bot 原型上以 this 调用，依赖 this.request

// 获取全局自定义菜单
async function getMenu() {
  const { data } = await this.request.get(`/v2/menu`)
  return data
}

// 修改全局自定义菜单
async function changeMenu(menu) {
  const { data } = await this.request.put(`/v2/menu`, { menu })
  return data
}

// 获取指令面板列表
async function getPanels(scope = 'group') {
  if (!['c2c', 'group', 'channel', 'dm'].includes(scope)) {
    throw new Error(`scope参数必须为c2c|group|channel|dm,当前：${scope}`)
  }
  const _getPanels = async (cursor = undefined) => {
    const { data } = await this.request.get(`/v2/panels`, {
      params: { scope, cursor, limit: 50 },
    })
    const records = data.records
    if (data.is_end) return records
    if (!data.next_cursor) return records
    return [...records, ...await _getPanels(data.next_cursor)]
  }
  return await _getPanels()
}

// 创建指令面板
async function createPanels(scope, target_type, user_openids = [], group_openids = [], panel) {
  const { data } = await this.request.post(`/v2/panels`, {
    scope,
    target_type,
    user_openids,
    group_openids,
    panel,
  })
  return data
}

// 获取指令面板详情
async function getPanel(panel_id) {
  const { data } = await this.request.get(`/v2/panels/${panel_id}`)
  return data
}

// 修改指令面板
async function changePanel(panel_id, panel) {
  const { data } = await this.request.put(`/v2/panels/${panel_id}`, { panel })
  return data
}

// 删除指令面板
async function deletePanel(panel_id) {
  const result = await this.request.delete(`/v2/panels/${panel_id}`)
  return result.status === 204
}

// 修改指令面板关联对象
async function changePanelTarget(panel_id, op, useropenids, groupopenids) {
  if (!['add', 'del'].includes(op)) throw new Error(`op参数必须为add|del,当前：${op}`)
  if (useropenids.length > 20 || groupopenids.length > 20) throw new Error(`useropenids和groupopenids最多可添加20个`)
  const { data } = await this.request.put(`/v2/panels/${panel_id}/target`, {
    op,
    useropenids,
    groupopenids,
  })
  return data
}

module.exports = {
  getMenu,
  changeMenu,
  getPanels,
  createPanels,
  getPanel,
  changePanel,
  deletePanel,
  changePanelTarget,
}
