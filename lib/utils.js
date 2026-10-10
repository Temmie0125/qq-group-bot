const crypto = require("crypto");
const fs = require("fs");
const axios = require("axios");

const toObject = (data) => {
    if (Buffer.isBuffer(data))
        return JSON.parse(data.toString());
    if (typeof data === 'object')
        return data;
    if (typeof data === 'string')
        return JSON.parse(data);
    // return String(data);
};
exports.toObject = toObject;
/** md5 hash */
const md5 = (data) => crypto.createHash("md5").update(data).digest().toString('hex');
exports.md5 = md5;
function isEmpty(data) {
    if (!data)
        return true;
    if (typeof data !== "object")
        return false;
    return Reflect.ownKeys(data).length === 0;
}
exports.isEmpty = isEmpty;
function remove(list, item) {
    const index = list.indexOf(item);
    if (index !== -1)
        list.splice(index, 1);
}
exports.remove = remove;
async function getBase64FromLocal(filepath) {
    return (await fs.readFileSync(filepath.replace("file://", ""))).toString('base64');
}
exports.getBase64FromLocal = getBase64FromLocal;
async function getBase64FromWeb(url) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer'
    });
    return Buffer.from(res.data).toString('base64');
}
exports.getBase64FromWeb = getBase64FromWeb;
function getFileBase64(file) {
    if (Buffer.isBuffer(file))
        return file.toString('base64');
    if (file.startsWith('http'))
        return getBase64FromWeb(file);
    if (file.startsWith('base64://'))
        return file.replace('base64://', '');
    try {
        return getBase64FromLocal(file);
    }
    catch { }
    return file;
}
exports.getFileBase64 = getFileBase64;
function deepClone(obj) {
    if (typeof obj !== "object")
        return obj;
    if (Array.isArray(obj))
        return obj.map(deepClone);
    const Constructor = obj.constructor;
    let newObj = Constructor();
    for (let key in obj) {
        newObj[key] = deepClone(obj[key]);
    }
    return newObj;
}
exports.deepClone = deepClone;
/**
 * 寻找数组中最后一个符合条件的元素下标
 * @param list 数组
 * @param predicate 条件
 * @returns {number} 元素下标，未找到返回-1
 */
function findLastIndex(list, predicate) {
    for (let i = list.length - 1; i >= 0; i--) {
        if (predicate(list[i], i))
            return i;
    }
    return -1;
}
exports.findLastIndex = findLastIndex;
function trimQuote(str) {
    const quotes = [
        [
            '"',
            '"',
        ],
        [
            "'",
            "'",
        ],
        [
            '`',
            '`',
        ],
        [
            '“',
            '”',
        ],
        [
            '‘',
            '’',
        ]
    ];
    for (let i = 0; i < quotes.length; i++) {
        const [start, end] = quotes[i];
        if (str.startsWith(start) && str.endsWith(end)) {
            return str.slice(1, -1);
        }
    }
    return str;
}
exports.trimQuote = trimQuote;
