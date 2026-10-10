// 两步导出：
// 1. Object.assign 原地填充 exports —— 加载期的循环依赖模块（sender/notice 顶层 require("..")）
//    拿到的是同一个对象引用，index 执行完后即可取到 md5/AuditType 等
// 2. module.exports = {...} 对象字面量 —— Node cjs-module-lexer 可静态识别，ESM 命名导入可用
Object.assign(exports, 
    require("./qqBot"),
    require("./bot"),
    require("./elements"), 
    require("./types"), 
    require("./utils"), 
    require("./message")
);
module.exports = { 
    ...require("./qqBot"), 
    ...require("./bot"), 
    ...require("./elements"), 
    ...require("./types"), 
    ...require("./utils"), 
    ...require("./message") 
};
