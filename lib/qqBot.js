const axios = require("axios");
const formdata_node_1 = require("formdata-node");
const log4js = require("log4js");
const events_1 = require("events");
const sessionManager_1 = require("./sessionManager");
const event_1 = require("./event");
const utils_1 = require("./utils");
const fileTypeReady = import('file-type').then((mod) => mod.fileTypeFromBuffer);
class QQBot extends events_1.EventEmitter {
    constructor(config) {
        var _a;
        super();
        this.config = config;
        this.sessionManager = new sessionManager_1.SessionManager(this);
        this.request = axios.create({
            baseURL: this.config.sandbox ? 'https://sandbox.api.sgroup.qq.com' : this.config.newapi ? 'https://api.bot.qq.com' : 'https://api.sgroup.qq.com',
            timeout: config.timeout || 5000,
            headers: {
                'User-Agent': `BotNodeSDK/0.0.1`
            }
        });
        this.request.interceptors.request.use((config) => {
            config.headers['Authorization'] = `QQBot ${this.sessionManager.access_token}`;
            config.headers['X-Union-Appid'] = this.config.appid;
            if (config['rest']) {
                const restObj = config['rest'];
                delete config['rest'];
                for (const key in restObj) {
                    config.url = config.url.replace(':' + key, restObj[key]);
                }
            }
            if (config.headers['Content-Type'] === 'multipart/form-data') {
                delete config.data.message_reference;
                const formData = new formdata_node_1.FormData();
                for (const key in config.data)
                    if (config.data[key] !== undefined)
                        formData.set(key, config.data[key]);
                config.data = formData;
            }
            return config;
        });
        this.request.interceptors.response.use((res) => res, (res) => {
            if (!res || !res.response || !res.response.data)
                return Promise.reject(res);
            const { code = res?.response.status, message = res?.response.statusText } = res?.response?.data || {};
            const err = new Error(`request "${res.config.url}" error with code(${code}): ${message}`);
            return Promise.reject(err);
        });
        this.logger = log4js.getLogger(`[QQBot:${this.config.appid}]`);
        this.logger.level = (_a = this.config).logLevel || (_a.logLevel = 'info');
    }
    removeAt(payload) {
        if (this.config.removeAt === false) return;
        payload.content = payload.content.replace(/<@!?[A-Za-z0-9]+>/g, '').replace(/\[@.*?\]/g, '')|| ''
    }
    processPayload(event_id, event, payload) {
        let [post_type, ...sub_type] = event.split('.');
        const result = {
            event_id,
            post_type,
            [`${post_type}_type`]: sub_type.join('.'),
            ...payload
        };
        const parser = event_1.EventParserMap.get(event);
        if (!parser)
            return result;
        return parser.apply(this, [event, result]);
    }
    dispatchEvent(event, wsRes) {
        this.logger.debug(event, wsRes);

        const d = wsRes?.d && typeof wsRes.d === 'object' ? wsRes.d : {}
        const payload = { ...d, raw: wsRes }

        const event_id = wsRes.id || '';
        if (!payload || !event)
            return;
        const transformEvent = event_1.QQEvent[event] || 'system';
        const result = this.processPayload(event_id, transformEvent, payload);
        if (!result)
            return this.logger.debug('解析事件失败', wsRes);
        this.em(transformEvent, result);
    }
    /**
     * 上传多媒体文件
     * @param target_id 接受者id
     * @param target_type  接受者类型：user|group
     * @param file_data 文件数据：可以是本地文件(file://)或网络地址(http://)或base64或Buffer
     * @param file_type 数据类型：1 image;2 video; 3 audio; 4 file
     * @returns
     */
    /*async uploadMedia(target_id, target_type, file_data, file_type, decode = false,file_name = '') {
        file_data = await (0, utils_1.getFileBase64)(file_data);
        const { data: result } = await this.request.post(`/v2/${target_type}s/${target_id}/files`, {
            file_name,
            file_type,
            file_data,
            srv_send_msg: false,
        });
        if (!decode)
            return result;
    }*/

    async uploadMedia(target_id, target_type, file_data, file_type, decode = false, file_name = '') {
        const MAX_DIRECT_SIZE = 10 * 1024 * 1024;
        file_data = await (0, utils_1.getFileBase64)(file_data);
        const fileBuffer = Buffer.from(file_data, 'base64');
        const fileSize = fileBuffer.length;
        if (!file_name || file_name.length > 20) {
            file_name = `file_${Date.now()}.${await this.getFileExtension(fileBuffer, file_name)}`;
        }
        if (fileSize <= MAX_DIRECT_SIZE) {
            const { data: result } = await this.request.post(`/v2/${target_type}s/${target_id}/files`, {
                file_name,
                file_type,
                file_data,
                srv_send_msg: false,
            });
            if (!decode) return result;
        } else {
            const crypto = require("crypto");
            const md5 = crypto.createHash("md5").update(fileBuffer).digest("hex");
            const sha1 = crypto.createHash("sha1").update(fileBuffer).digest("hex");
            const MD5_10M_SIZE = 10002432;
            const md5_10m = fileSize > MD5_10M_SIZE ? crypto.createHash("md5").update(fileBuffer.subarray(0, MD5_10M_SIZE)).digest("hex") : md5;
            const prepareResult = await this.request.post(`/v2/${target_type}s/${target_id}/upload_prepare`, {
                file_type,
                file_name,
                file_size: fileSize,
                md5,
                sha1,
                md5_10m
            });
            if (!prepareResult.data || !prepareResult.data.upload_id) {
                throw new Error('分片上传准备失败');
            }
            const { upload_id, parts, block_size } = prepareResult.data;
            const blockSize = Number(block_size) || 1024 * 1024;
            this.logger.info(`文件较大，使用分片上传: upload_id=${upload_id}, 分片数=${parts.length}`);
            const concurrency = this.config.concurrency || 1;
            const partChunks = [] // 保存每个分片的 chunk/md5/index，供后续按序确认
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i]
                const partIndex = part.index || (i + 1)
                const offset = (partIndex - 1) * blockSize
                const length = Math.min(blockSize, fileSize - offset)
                const chunk = Buffer.from(fileBuffer.subarray(offset, offset + length))
                if (chunk.length === 0) continue
                partChunks.push({ partIndex, length, chunk, presigned_url: part.presigned_url })
            }
            let cursor = 0
            let firstError = null
            const worker = async () => {
            while (cursor < partChunks.length) {
                const idx = cursor++
                const pc = partChunks[idx]
                try {
                    const putRes = await this.putToCos(pc.presigned_url, pc.chunk)
                    if (!putRes.status || putRes.status < 200 || putRes.status >= 300) {
                        throw new Error(`分片 ${pc.partIndex} 上传失败: ${putRes.status} ${putRes.body.slice(0, 200)}`)
                    }
                } catch (e) {
                    if (!firstError) firstError = e
                    throw e
                }
            }
            }
            const workers = []
            for (let w = 0; w < Math.min(concurrency, partChunks.length); w++) workers.push(worker())
            let start = Date.now()
            await Promise.all(workers)
            let puttime = Date.now()
            logger.info(`put耗时${puttime-start}ms`)
            if (firstError) throw firstError
            // 3) 分片完成确认 upload_part_finish 必须串行按序调用（并发会触发 40093001）
            for (const pc of partChunks) {
                await this.request.post(`/v2/${target_type}s/${target_id}/upload_part_finish`, {
                    upload_id: upload_id,
                    part_index: pc.partIndex,
                    block_size: pc.length,
                    md5: crypto.createHash('md5').update(pc.chunk).digest('hex'),
                })
            }
            let partfinish = Date.now()
            logger.info(`part_finish耗时${partfinish-puttime}ms`)
            /*for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const partIndex = part.index || (i + 1);
                const offset = (partIndex - 1) * blockSize;
                const length = Math.min(blockSize, fileSize - offset);
                const chunk = fileBuffer.subarray(offset, offset + length);

                this.logger.debug(`上传分片 ${partIndex}/${parts.length} (${Math.round(length / 1024)}KB)`);
                const response = await fetch(part.presigned_url, {
                    method: 'PUT',
                    body: chunk,
                    headers: {
                        'Content-Length': String(chunk.length),
                    },
                });
                if (!response.ok) {
                    throw new Error(`分片上传失败: ${response.status} ${response.statusText}`);
                }
                await this.request.post(`/v2/${target_type}s/${target_id}/upload_part_finish`, {
                    upload_id,
                    part_index: partIndex,
                    block_size: length,
                    md5: crypto.createHash("md5").update(chunk).digest("hex")
                });
            }*/
            const completeResult = await this.request.post(`/v2/${target_type}s/${target_id}/files`, {
                upload_id: upload_id
            });
            logger.info(`files耗时${Date.now()-partfinish}ms`)
            if (!decode) {
                return {
                    file_info: completeResult.data.file_info
                };
            }
        }
    }

    async putToCos(presignedUrl, chunk) {
        const https = require("node:https");
        const internal = this.config.internal || false
        const region = (this.config.region || 'ap-guangzhou').trim()
        const u = new URL(presignedUrl)
        const originalHost = u.host
        const connectHost = internal && originalHost.includes('cos.accelerate.myqcloud.com')
        ? originalHost.replace('cos.accelerate.myqcloud.com', `cos.${region}.myqcloud.com`)
        : originalHost
        return new Promise((resolve, reject) => {
        const req = https.request(
            {
            protocol: u.protocol,
            host: connectHost,
            path: u.pathname + u.search,
            method: 'PUT',
            headers: {
                Host: originalHost,
                'Content-Length': String(chunk.length),
            },
            },
            (res) => {
            let body = ''
            res.setEncoding('utf8')
            res.on('data', (d) => (body += d))
            res.on('end', () => resolve({ status: res.statusCode, body }))
            }
        )
        req.on('error', reject)
        req.setTimeout(30000, () => req.destroy(new Error('PUT 超时')))
        req.write(chunk)
        req.end()
        })
    }

    async getFileExtension(buffer, file_name = '') {
        if (file_name) {
            const idx = file_name.lastIndexOf('.');
            if (idx >= 0) {
                const ext = file_name.slice(idx + 1).toLowerCase().replace(/[\/\\?%*:|"<>]/g, '');
                if (ext)
                    return ext;
            }
        }
        const fileTypeFromBuffer = await fileTypeReady;
        const ft = await fileTypeFromBuffer(buffer);
        if (ft && ft.ext)
            return ft.ext;
        return 'bin';
    }
    em(event, payload) {
        const eventNames = event.split('.');
        const [post_type, detail_type, ...sub_type] = eventNames;
        Object.assign(payload, {
            post_type,
            [`${post_type}_type`]: detail_type,
            sub_type: sub_type.join('.'),
            ...payload
        });
        let prefix = '';
        while (eventNames.length) {
            let fullEventName = `${prefix}.${eventNames.shift()}`;
            if (fullEventName.startsWith('.'))
                fullEventName = fullEventName.slice(1);
            this.emit(fullEventName, payload);
            prefix = fullEventName;
        }
    }
}
exports.QQBot = QQBot;
(function (QQBot) {
    function getFullTargetId(message) {
        switch (message.message_type) {
            case "private":
                return `private-${message.guild_id || message.user_id}`;
            case "group":
                return `group-${message.group_id}:${message.user_id}`;
            case "guild":
                return `guild-${message.channel_id}:${message.user_id}`;
        }
    }
    QQBot.getFullTargetId = getFullTargetId;
})(QQBot || (exports.QQBot = QQBot = {}));
