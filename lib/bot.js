const qqBot_1 = require("./qqBot");

// ==================== API 模块化（按业务分类拆分到 ./api） ====================
// 各 api/*.js 导出方法组（函数首参隐式 this），在此统一挂回 Bot.prototype，
// 保证 bot.xxx() 的调用方式与重构前完全一致。
const guildApi = require("./api/guild");
const channelApi = require("./api/channel");
const groupApi = require("./api/group");
const messageApi = require("./api/message");
const panelApi = require("./api/panel");
const interactionApi = require("./api/interaction");
const helperApi = require("./api/helper");
const friendApi = require("./api/friend");

class Bot extends qqBot_1.QQBot {
  constructor(config) {
    super(config);
    const nodeVersion = parseInt(process.version.slice(1));
    if (nodeVersion < 16) {
      this.logger.warn(`你的node版本(${process.version}) <16，可能会出现不可预测的错误，请升级node版本，为确保服务正常运行，请升级node版本`);
    }
    process.on("uncaughtException", e => {
      this.logger.debug(e.stack);
    });
  }

  async start() {
    await this.sessionManager.start();
    return this;
  }
  async stop() {
    await this.sessionManager.stop();
  }
}

// 将分类 API 方法挂回 Bot 原型（调用方式保持不变：bot.sendGroupMessage(...) 等）
Object.assign(Bot.prototype,
  guildApi,
  channelApi,
  groupApi,
  messageApi,
  panelApi,
  interactionApi,
  helperApi,
  friendApi,
);

exports.Bot = Bot;
function defineConfig(config) {
  return config;
}
exports.defineConfig = defineConfig;
function createBot(config) {
  return new Bot(config);
}
exports.createBot = createBot;
