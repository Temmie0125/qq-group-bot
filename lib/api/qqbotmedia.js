const crypto = require("crypto");
const https = require("node:https");
const { getFileBase64 } = require("../utils");

// 单张图片大小上限：10MB
const MEDIA_IMAGE_MAX_SIZE = 10 * 1024 * 1024;
// 允许的扩展名
const EXT_CONTENT_TYPE_MAP = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};
// Content-Type
const CONTENT_TYPE_EXT_MAP = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};
// 素材管理相关错误码
const MediaImageErrorCode = {
  40035001: '图片格式不支持（扩展名与 Content-Type 需为 png/jpeg/gif/webp 且一致）',
  40035002: '图片超过大小上限（默认 10MB）',
  40035003: '上传任务不存在、已过期（超过 4 小时）或不属于当前机器人',
  40035006: '服务端内部错误（COS 处理、链接生成等失败），可稍后重试',
  40035007: '图片数量超过上限（100 张），删除部分图片后重试',
  40035008: '图片不存在或已被删除',
  40035009: '图片已过期或已被删除，引用链接不再可用',
  40035010: '引用链接无效，或不属于当前机器人',
};

// 从 file/file_name 推断文件名
function inferFileName(file, file_name = '') {
  if (file_name) return String(file_name);
  if (typeof file === 'string' && (file.startsWith('http://') || file.startsWith('https://'))) {
    try {
      const pathname = new URL(file).pathname;
      const name = pathname.split('/').pop();
      if (name && name.includes('.')) return name;
    } catch { }
  }
  if (typeof file === 'string' && !file.startsWith('base64://') && !file.startsWith('data:')) {
    const name = file.replace(/^file:\/\//, '').split(/[\\/]/).pop();
    if (name && name.includes('.')) return name;
  }
  return '';
}

// 根据扩展名取 Content-Type
async function resolveContentType(buffer, file_name) {
  const ext = String(file_name).split('.').pop().toLowerCase();
  if (EXT_CONTENT_TYPE_MAP[ext]) return { ext, content_type: EXT_CONTENT_TYPE_MAP[ext] };
  try {
    const { fileTypeFromBuffer } = await import('file-type');
    const ft = await fileTypeFromBuffer(buffer);
    if (ft && CONTENT_TYPE_EXT_MAP[ft.mime]) return { ext: CONTENT_TYPE_EXT_MAP[ft.mime], content_type: ft.mime };
  } catch { }
  return { ext, content_type: '' };
}

// 申请图片上传
async function prepareMediaImage(file_name, file_size, content_type, md5, sha1) {
  if (!file_name || !file_name.includes('.')) throw new Error('file_name 必须包含扩展名，如 kline.png');
  const ext = file_name.split('.').pop().toLowerCase();
  if (EXT_CONTENT_TYPE_MAP[ext] !== content_type) {
    throw new Error(`扩展名(.${ext})与 Content-Type(${content_type}) 不一致（40035001）`);
  }
  if (file_size > MEDIA_IMAGE_MAX_SIZE) {
    throw new Error(`图片大小 ${file_size} 超过上限 ${MEDIA_IMAGE_MAX_SIZE}（40035002）`);
  }
  const { data } = await this.request.post(`/v2/media-images/prepare`, {
    file_name,
    file_size,
    content_type,
    md5,
    sha1,
  });
  return data;
}

async function putMediaImage(presigned_url, buffer, content_type) {
  const u = new URL(presigned_url);
  const internal = this.config.internal || false;
  const region = (this.config.region || 'ap-guangzhou').trim();
  const connectHost = internal && u.host.includes('cos.accelerate.myqcloud.com')
    ? u.host.replace('cos.accelerate.myqcloud.com', `cos.${region}.myqcloud.com`)
    : u.host;
  const timeout = this.config.uploadTimeout || 60000;
  return new Promise((resolve, reject) => {
    const req = https.request({
      protocol: u.protocol,
      host: connectHost,
      path: u.pathname + u.search,
      method: 'PUT',
      headers: {
        Host: u.host,
        'Content-Type': content_type,
        'Content-Length': String(buffer.length),
      },
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({
        status: res.statusCode,
        etag: String(res.headers.etag || res.headers.ETag || '').replace(/^"|"$/g, ''),
        body,
      }));
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => req.destroy(new Error('PUT 上传超时')));
    req.write(buffer);
    req.end();
  });
}

// 完成图片上传
async function completeMediaImage(upload_id, md5) {
  const { data } = await this.request.post(`/v2/media-images/complete`, { upload_id, md5 });
  return data;
}

/**
 * @param file 图片数据
 * @param file_name 文件名
 * @returns { image_id, url, ttl, preview_url }
 */
async function uploadMediaImage(file, file_name = '') {
  const file_data = await getFileBase64(file);
  const buffer = Buffer.from(file_data, 'base64');
  const file_size = buffer.length;
  if (!file_size) throw new Error('图片内容为空');
  if (file_size > MEDIA_IMAGE_MAX_SIZE) {
    throw new Error(`图片大小 ${file_size} 超过上限 ${MEDIA_IMAGE_MAX_SIZE}（40035002）`);
  }
  let name = inferFileName(file, file_name);
  const { ext, content_type } = await resolveContentType(buffer, name);
  if (!content_type) {
    throw new Error(`图片格式不支持，仅支持 png/jpeg/gif/webp`);
  }
  if (!name || !EXT_CONTENT_TYPE_MAP[name.split('.').pop().toLowerCase()]) {
    name = `image_${Date.now()}.${ext}`;
  }
  const md5 = crypto.createHash("md5").update(buffer).digest("hex");
  const sha1 = crypto.createHash("sha1").update(buffer).digest("hex");

  const prepare = await this.prepareMediaImage(name, file_size, content_type, md5, sha1);
  if (!prepare?.upload_id || !prepare?.presigned_url) throw new Error('申请图片上传失败，未返回 upload_id/presigned_url');

  const put = await this.putMediaImage(prepare.presigned_url, buffer, content_type);
  if (put.status < 200 || put.status >= 300) {
    throw new Error(`图片直传失败(${put.status}): ${put.body.slice(0, 200)}${put.status === 403 ? '（Content-Type 与 prepare 声明不一致或预签名已过期）' : ''}`);
  }
  const result = await this.completeMediaImage(prepare.upload_id, put.etag || md5);
  this.logger.info(`素材上传完成: image_id=${result.image_id}, ttl=${result.ttl}`);
  return result;
}

// 查询有效图片列表
async function getMediaImages(cursor) {
    const _getMediaImages = async (cursor = undefined) => {
        const res = await this.request.get(`/v2/media-images`, { 
            params: { 
                cursor 
            } 
        }).catch(() => ({ data: [] }))
        const { images = [], next_cursor } = res.data
        if (!next_cursor || next_cursor === cursor) return images
        return [...images, ...await _getMediaImages(next_cursor)]
    }
    return _getMediaImages()
}

// 删除图片素材
async function deleteMediaImage(image_id) {
    const result = await this.request.delete(`/v2/media-images/${image_id}/delete`);
    return result.status >= 200 && result.status < 300;
}

module.exports = {
  MediaImageErrorCode,
  prepareMediaImage,
  putMediaImage,
  completeMediaImage,
  uploadMediaImage,
  getMediaImages,
  deleteMediaImage,
}
