const axios = require("axios");
const ws_1 = require("ws");
const utils_1 = require("./utils");
const events_1 = require("events");
const constans_1 = require("./constans");
exports.MAX_RETRY = Infinity;
class SessionManager extends events_1.EventEmitter {
    constructor(bot) {
        super();
        this.bot = bot;
        this.retry = 0;
        this.reconnectTimer = null; // 重试定时器
        this.baseReconnectDelay = 10000; // 基础重连延迟10秒
        this.tokenTask = null;
        this.tokenTimer = null;
        this.fatalError = false; // 凭证永久失效标志
        this.tokenExpired = false; // token 可能过期，需要重新获取
        this.sessionRecord = {
            sessionID: "",
            seq: 0
        };
        this.heartbeatParam = {
            op: constans_1.OpCode.HEARTBEAT,
            d: null // 心跳唯一值
        };
        this.heartbeatTimer = null; // 下一次心跳的定时器
        this.heartbeatWatchdog = null; // 心跳存活检测定时器
        this.lastHeartbeatAckAt = 0; // 最近一次收到心跳回包的时间戳
        this.on(constans_1.SessionEvents.EVENT_WS, (data) => {
            switch (data.eventType) {
                case constans_1.SessionEvents.RECONNECT:
                    this.bot.logger.mark("[CLIENT] 等待断线重连中...");
                    break;
                case constans_1.SessionEvents.DISCONNECT:
                    if (this.userClose || [4914, 4915].includes(data.code)){
                        return;
                    }
                    if (this.fatalError) {
                        this.bot.logger.error(`[CLIENT] Bot ${this.bot.config.appid} 凭证错误Appid或Secret错误`);
                        this.emit(constans_1.SessionEvents.DEAD, {
                            eventType: constans_1.SessionEvents.ERROR,
                            msg: `Bot ${this.bot.config.appid} 凭证错误Appid或Secret错误`
                        });
                        return;
                    }
                    if (this.retry < (this.bot.config.maxRetry || exports.MAX_RETRY)) {
                        this.bot.logger.mark(`[CLIENT] 连接断开，${this.baseReconnectDelay/1000}秒后第${this.retry + 1}次重连...`);
                        // 清除可能存在的旧定时器
                        if (this.reconnectTimer) {
                            clearTimeout(this.reconnectTimer);
                        }
                        // 设置延迟重连
                        this.reconnectTimer = setTimeout(() => {
                            if (constans_1.WebsocketCloseReason.find((v) => v.code === data.code)?.resume) {
                                this.sessionRecord = data.eventMsg;
                            }
                            this.isReconnect = data.code === 4009;
                            this.bot.logger.mark(`[CLIENT] 开始第${this.retry + 1}次重连`);
                            this.start();
                            this.retry += 1;
                        }, this.retry >= 3 ? this.baseReconnectDelay : 1);
                    }
                    else {
                        this.bot.logger.mark("[CLIENT] 超过重试次数，连接终止");
                        this.emit(constans_1.SessionEvents.DEAD, {
                            eventType: constans_1.SessionEvents.ERROR,
                            msg: "连接已死亡，请检查网络或重启"
                        });
                    }
                    break;
                case constans_1.SessionEvents.READY:
                    this.bot.logger.mark("[CLIENT] 连接成功");
                    this.retry = 0;
                    break;
                default:
            }
        });
        this.on(constans_1.SessionEvents.ERROR, (code, message) => {
            this.bot.logger.error(`[CLIENT] 发生错误：${code} ${message}`);
        });
        // 心跳存活检测：若超过两个心跳周期仍未收到服务端回包，说明连接已静默死亡，主动断开重连
        this.heartbeatWatchdog = setInterval(() => {
            var _a;
            if (!this.heartbeatInterval || !this.lastHeartbeatAckAt)
                return;
            const gap = Date.now() - this.lastHeartbeatAckAt;
            if (gap > this.heartbeatInterval * 2) {
                this.bot.logger.warn(`[CLIENT] 心跳超时（${gap}ms 未收到回包），主动重连`);
                this.lastHeartbeatAckAt = 0;
                this.alive = false;
                this.handleHeartbeatLost();
            }
        }, 15000);
        // 避免 watchdog 定时器阻止 Node 进程退出
        if (this.heartbeatWatchdog && typeof this.heartbeatWatchdog.unref === 'function') {
            this.heartbeatWatchdog.unref();
        }
    }
    async getAccessToken() {
        // token 被标记过期时，清除缓存强制重新请求
        if (this.tokenExpired) {
            this.tokenTask = null;
            this.tokenExpired = false;
        }
        if (this.tokenTask) return this.tokenTask;
        let { secret, appid } = this.bot.config;
        const getToken = () => {
            return new Promise((resolve, reject) => {
                let api = this.bot.config.newapi ? 'https://api.bot.qq.com/app/getAppAccessToken' : 'https://bots.qq.com/app/getAppAccessToken'
                axios.post(api, {
                    appId: appid,
                    clientSecret: secret
                }).then(res => {
                    if (res.status === 200 && res.data && typeof res.data === "object") {
                        // 检测 QQ API 返回的错误码（凭证无效）
                        if (res.data.code && res.data.code !== 0) {
                            const errMsg = res.data.message || res.data.msg || `错误码 ${res.data.code}`
                            reject(new Error(`[${res.data.code}] ${errMsg}`))
                            return
                        }
                        // 验证必须包含 access_token（secret 错误时 QQ 可能返回 200 但不含 token）
                        if (!res.data.access_token) {
                            reject(new Error("invalid clientSecret: QQ API 返回异常，缺少 access_token"))
                            return
                        }
                        resolve(res.data);
                    }
                    else {
                        this.bot.logger.warn("获取token响应异常，状态码:", res.status);
                        reject(new Error(`HTTP ${res.status}: 获取token失败`));
                    }
                }).catch(error => {
                    // 专门处理网络错误
                    if (error.code === 'ENOTFOUND' || error.code === 'ECONNABORTED') {
                        this.bot.logger.mark("网络异常，无法连接到认证服务器");
                    } else if (error.response) {
                        this.bot.logger.error("认证服务器错误:", error.response.status);
                    } else {
                        this.bot.logger.error("请求失败:", error.message);
                    }
                    reject(error);
                });
            });
        };
        this.tokenTask = (async () => {
            try {
                const token = await getToken();
                this.access_token = token.access_token;
                // token 获取成功，清除过期和失效标志
                this.tokenExpired = false;
                this.fatalError = false;

                if (this.tokenTimer) clearTimeout(this.tokenTimer);

                this.tokenTimer = setTimeout(() => {
                    this.tokenTask = null;
                    this.getAccessToken().catch(() => {});
                }, (token.expires_in - 50) * 1000);

                return token;
            } catch (e) {
                this.tokenTask = null;
                const errStr = String(e.message || e)
                // 致命错误（secret 无效）：标记 fatalError，统一在此处拦截
                if (errStr.includes("100016") || errStr.includes("invalid") || errStr.includes("secret") || errStr.includes("11244")) {
                    this.fatalError = true
                    throw e
                }
                this.bot.logger.error("getAccessToken失败", e);
                return null;
            }
        })();

        return this.tokenTask;
    }
    async getWsUrl() {
        return new Promise((resolve, reject) => {
            this.bot.request.get("/gateway/bot", {
                headers: {
                    Accept: "*/*",
                    "Accept-Encoding": "utf-8",
                    "Accept-Language": "zh-CN,zh;q=0.8",
                    Connection: "keep-alive",
                    "User-Agent": "v1",
                    Authorization: ""
                }
            }).then(res => {
                if (!res.data)
                    throw new Error("获取ws连接信息异常");
                this.wsUrl = res.data.url;
                this.bot.session_state = res.data.session_start_limit
                this.bot.session_state.time = Date.now()
                resolve();
            }).catch(error => {
                this.bot.logger.error("[CLIENT] 获取WS URL失败:", error.message);
                reject(error);
            });
        });
    }
    getValidIntends() {
        return (this.bot.config.intents || []).reduce((result, item) => {
            const value = constans_1.Intends[item];
            if (value === undefined) {
                this.bot.logger.warn(`Invalid intends(${item}),skip...`);
                return result;
            }
            return constans_1.Intends[item] | result;
        }, 0);
    }
    async start() {
        if (!(await this.checkNeedToRestart())) {
            return;
        }
        this.userClose = false;
        if (this.heartbeatTimer) {
            clearTimeout(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        this.lastHeartbeatAckAt = 0;
        this.connect();
        this.startListen();
    }
    async stop() {
        this.userClose = true;
        if (this.tokenTimer) {
            clearTimeout(this.tokenTimer);
            this.tokenTimer = null;
        }

        this.tokenTask = null;
        this.bot.ws?.close();
    }

    /* 校验是否需要重新创建 ws */
    async checkNeedToRestart() {
        try {
            const originWsUrl = this.wsUrl;
            const originAccessToken = this.access_token;
            try {
                await this.getAccessToken();
            } catch (error) {
                // getAccessToken 内部已统一设置 fatalError 标志
                if (this.fatalError) {
                    this.bot.logger.error(`[CLIENT] Bot ${this.bot.config.appid} 凭证错误Appid或Secret错误`)
                    this.emit(constans_1.SessionEvents.DEAD, {
                        eventType: constans_1.SessionEvents.ERROR,
                        msg: `Bot ${this.bot.config.appid} 凭证错误Appid或Secret错误`
                    });
                    return false
                }
                // 详细记录获取新 Token 失败的原因
                if (error.code === 'ENOTFOUND' || error.message?.includes('Network Error')) {
                    this.bot.logger.mark("网络异常，无法更新访问令牌AccessToken");
                } else if (error.response) {
                    this.bot.logger.error(`认证服务器响应错误 (${error.response.status})`);
                } else {
                    this.bot.logger.error(`获取AccessToken未知错误: ${error.message}`);
                }
            }
            // 使用try-catch包裹可能失败的Axios调用
            try {
                await this.getWsUrl();
            } catch (error) {
                if (error.type === 'NETWORK_UNAVAILABLE') {
                    // 网络错误时，仍然允许重连，使用已有凭证
                    this.bot.logger.mark('网络异常，使用缓存AccessToken尝试重连');
                } else {
                    const errStr = String(error.message || error)
                    if (errStr.includes("11244") || errStr.includes("token not exist")) {
                        // token 无效，标记过期让下次 getAccessToken 强制刷新
                        this.tokenExpired = true
                        this.bot.logger.mark("[CLIENT] Token 已过期，下次重连将刷新 AccessToken")
                    } else {
                        throw error;
                    }
                }
            }
            // 此时不存在示例或是实例正在关闭
            if (!this.bot.ws || ![0, 1].includes(this.bot.ws.readyState)) {
                return true;
            }
            const checked = originWsUrl !== this.wsUrl || originAccessToken !== this.access_token;
            // 重启前先停止原来的实例
            if (checked) {
                await this.stop();
            }
            return checked;
        } catch (error) {
            if (this.fatalError) {
                return false;
            }
            // 即使获取新AccessToken失败，也尝试用旧AccessToken重连
            this.bot.logger.warn('AccessToken更新失败，尝试使用现有连接:', error.message);
            return !this.bot.ws || ![0, 1].includes(this.bot.ws.readyState);
        }
    }
    connect() {
        this.bot.ws = new ws_1.WebSocket(this.wsUrl, {
            headers: {
                "Authorization": "QQBot " + this.access_token,
                "X-Union-Appid": this.bot.config.appid,
                "User-Agent": "QQBotPlugin/9.9.9 (Node/20.11.0; Linux; windtrace/1.0.20)"
            }
        });
    }
    reconnectWs() {
        const reconnectParam = {
            op: constans_1.OpCode.RESUME,
            d: {
                // token: `Bot ${this.bot.appId}${this.token}`,
                token: `QQBot ${this.access_token}`,
                session_id: this.sessionRecord.sessionID,
                seq: this.sessionRecord.seq
            }
        };
        this.sendWs(reconnectParam);
    }
    // 发送websocket
    sendWs(msg) {
        const ws = this.bot.ws;
        // 仅当连接处于 OPEN 状态时才发送，避免 CONNECTING/CLOSING 下发送导致异常
        if (!ws || ws.readyState !== ws_1.WebSocket.OPEN) {
            this.bot.logger.debug(`[CLIENT] WebSocket 未就绪(readyState=${ws ? ws.readyState : 'none'})，跳过本次发送`);
            return;
        }
        try {
            // 先将消息转为字符串
            ws.send(typeof msg === "string" ? msg : JSON.stringify(msg));
        }
        catch (e) {
            this.bot.logger.error(e);
        }
    }
    // 心跳超时：主动断开当前连接以触发 close -> 重连流程
    handleHeartbeatLost() {
        const ws = this.bot.ws;
        if (ws && ws.readyState !== ws_1.WebSocket.CLOSED) {
            try {
                ws.terminate();
            }
            catch (e) {
                this.bot.logger.error(e);
            }
        }
        else {
            // 没有可用连接，直接派发断线事件走重连
            this.emit(constans_1.SessionEvents.EVENT_WS, {
                eventType: constans_1.SessionEvents.DISCONNECT,
                code: 4000,
                eventMsg: this.sessionRecord
            });
        }
    }
    authWs() {
        // 鉴权参数
        const authOp = {
            op: constans_1.OpCode.IDENTIFY, // 鉴权参数
            d: {
                token: `QQBot ${this.access_token}`, // 根据配置转换token
                intents: this.getValidIntends(), // todo 接受的类型
                shard: [0, 1] // 分片信息,给一个默认值
            }
        };
        // 发送鉴权请求
        this.sendWs(authOp);
    }
    startListen() {
        this.bot.ws.on("close", (code) => {
            this.alive = false;
            if (this.heartbeatTimer) {
                clearTimeout(this.heartbeatTimer);
                this.heartbeatTimer = null;
            }
            this.lastHeartbeatAckAt = 0;
            this.emit(constans_1.SessionEvents.EVENT_WS, {
                eventType: constans_1.SessionEvents.DISCONNECT,
                code,
                eventMsg: this.sessionRecord
            });
            if (code) {
                for (const e of constans_1.WebsocketCloseReason) {
                    if (e.code === code) {
                        return this.emit(constans_1.SessionEvents.ERROR, code, e.reason);
                    }
                }
                return this.emit(constans_1.SessionEvents.ERROR, code, '未知错误');
            }
            this.bot.logger.error(`[CLIENT] 连接关闭`);
        });
        this.bot.ws.on("error", (e) => {
            this.alive = false;
            if (this.heartbeatTimer) {
                clearTimeout(this.heartbeatTimer);
                this.heartbeatTimer = null;
            }
            this.lastHeartbeatAckAt = 0;
            this.bot.logger.mark("[CLIENT] 连接错误");
            this.emit(constans_1.SessionEvents.CLOSED, { eventType: constans_1.SessionEvents.CLOSED });
        });
        this.bot.ws.on("message", (data) => {
            this.bot.logger.debug(`[CLIENT] 收到消息: ${data}`);
            // 先将消息解析
            const wsRes = (0, utils_1.toObject)(data);
            // 先判断websocket连接是否成功
            if (wsRes?.op === constans_1.OpCode.HELLO && wsRes?.d?.heartbeat_interval) {
                // websocket连接成功，拿到心跳周期
                this.heartbeatInterval = wsRes?.d?.heartbeat_interval;
                this.lastHeartbeatAckAt = 0;
                if (this.heartbeatTimer) {
                    clearTimeout(this.heartbeatTimer);
                    this.heartbeatTimer = null;
                }
                // 非断线重连时，需要鉴权
                this.isReconnect ? this.reconnectWs() : this.authWs();
                return;
            }
            // 鉴权通过
            if (wsRes.t === constans_1.SessionEvents.READY) {
                this.bot.logger.mark(`[CLIENT] 鉴权通过`);
                const { d, s } = wsRes;
                const { session_id, user = {} } = d;
                this.bot.self_id = user.id;
                this.bot.nickname = user.username;
                this.bot.status = user.status || 0;
                // 获取当前会话参数
                if (session_id && s) {
                    this.sessionRecord.sessionID = session_id;
                    this.sessionRecord.seq = s;
                    this.heartbeatParam.d = s;
                }
                this.bot.logger.info(`connect to ${user.username}(${user.id})`);
                this.isReconnect = false;
                this.emit(constans_1.SessionEvents.READY, { eventType: constans_1.SessionEvents.READY, msg: d || "" });
                // 第一次发送心跳
                this.bot.logger.debug(`[CLIENT] 发送第一次心跳`, this.heartbeatParam);
                this.sendWs(this.heartbeatParam);
                return;
            }
            // 心跳测试
            if (wsRes.op === constans_1.OpCode.HEARTBEAT_ACK || wsRes.t === constans_1.SessionEvents.RESUMED) {
                if (!this.alive) {
                    this.alive = true;
                    this.emit(constans_1.SessionEvents.EVENT_WS, { eventType: constans_1.SessionEvents.READY });
                }
                // 记录最近一次收到服务端心跳回包的时间，供存活检测使用
                this.lastHeartbeatAckAt = Date.now();
                this.bot.logger.debug("[CLIENT] 心跳校验", this.heartbeatParam);
                if (this.heartbeatTimer)
                    clearTimeout(this.heartbeatTimer);
                this.heartbeatTimer = setTimeout(() => {
                    this.heartbeatTimer = null;
                    this.sendWs(this.heartbeatParam);
                }, this.heartbeatInterval);
            }
            // 收到服务端重连的通知
            if (wsRes.op === constans_1.OpCode.RECONNECT) {
                // 通知会话，当前已断线
                this.emit(constans_1.SessionEvents.EVENT_WS, { eventType: constans_1.SessionEvents.RECONNECT });
            }
            // 服务端主动推送的消息
            if (wsRes.op === constans_1.OpCode.DISPATCH) {
                // 更新心跳唯一值
                const { s } = wsRes;
                if (s)
                    this.sessionRecord.seq = this.heartbeatParam.d = s;
                // OpenAPI事件分发
                this.bot.dispatchEvent(wsRes.t, wsRes);
            }
        });
    }
}
exports.SessionManager = SessionManager;
