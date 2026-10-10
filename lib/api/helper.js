// 内部辅助(Helper)方法：消息模板解析、消息内容拼装
// 所有方法在 Bot 原型上以 this 调用（parseFromTemplate 为纯函数，processMessage 依赖 this.parseFromTemplate）

// 将 <type,key=val> 模板解析为结构化消息段
function parseFromTemplate(template) {
  const result = []
  const reg = /(<[^>]+>)/
  while (template.length) {
    const [match] = template.match(reg) || []
    if (!match) break
    const index = template.indexOf(match)
    const prevText = template.slice(0, index)
    if (prevText) result.push({ type: 'text', text: prevText })
    template = template.slice(index + match.length)
    const [type, ...attrArr] = match.slice(1, -1).split(',')
    const attrs = Object.fromEntries(attrArr.map((attr) => {
      const [key, value] = attr.split('=')
      try {
        return [key, JSON.parse(value)]
      } catch {
        return [key, value]
      }
    }))
    result.push({ type, ...attrs })
  }
  if (template.length) result.push({ type: 'text', text: template })
  return result
}

// 将消息段数组拼装为频道内容字符串
async function processMessage(message) {
  let messages = message
  let content = ''
  if (Array.isArray(messages)) messages = [...messages]
  while (messages.length) {
    const elem = messages.shift()
    if (typeof elem === 'string') {
      const index = messages.findIndex((item) => item === elem)
      messages.splice(index, 0, ...this.parseFromTemplate(elem))
      continue
    }
    logger.info(elem)
    switch (elem.type) {
      case 'at':
        content += `<@${elem.user_id === 'all' ? 'everyone' : elem.user_id}>`
        break
      case 'link':
        content += `<#${elem.channel_id}>`
        break
      case 'text':
        content += elem.text
        break
      case 'face':
        content += `<emoji:${elem.id}>`
        break
      case 'markdown':
        if (elem.content) {
          content += elem.content
          break
        } else return null
      default:
        return null
    }
  }
  return content.replace(/<[^>]*>|(>)/g, (match) => {
    if (match[0] === '<' && match[match.length - 1] === '>') return match
    return ''
  })
}

module.exports = {
  parseFromTemplate,
  processMessage,
}
