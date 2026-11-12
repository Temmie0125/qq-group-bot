// 心跳参数
var OpCode;
(function (OpCode) {
    OpCode[OpCode["DISPATCH"] = 0] = "DISPATCH";
    OpCode[OpCode["HEARTBEAT"] = 1] = "HEARTBEAT";
    OpCode[OpCode["IDENTIFY"] = 2] = "IDENTIFY";
    OpCode[OpCode["RESUME"] = 6] = "RESUME";
    OpCode[OpCode["RECONNECT"] = 7] = "RECONNECT";
    OpCode[OpCode["INVALID_SESSION"] = 9] = "INVALID_SESSION";
    OpCode[OpCode["HELLO"] = 10] = "HELLO";
    OpCode[OpCode["HEARTBEAT_ACK"] = 11] = "HEARTBEAT_ACK";
})(OpCode || (exports.OpCode = OpCode = {}));
exports.UnsupportedMethodError = new Error('暂未支持');
exports.SessionEvents = {
    CLOSED: "CLOSED",
    READY: "READY", // 已经可以通信
    ERROR: "ERROR", // 会话错误
    INVALID_SESSION: "INVALID_SESSION",
    RECONNECT: "RECONNECT", // 服务端通知重新连接
    DISCONNECT: "DISCONNECT", // 断线
    EVENT_WS: "EVENT_WS", // 内部通信
    RESUMED: "RESUMED", // 重连
    DEAD: "DEAD" // 连接已死亡，请检查网络或重启
};
// websocket错误原因
exports.WebsocketCloseReason = [
    {
        code: 4001,
        reason: "无效的opcode"
    },
    {
        code: 4002,
        reason: "无效的payload"
    },
    {
        code: 4007,
        reason: "seq错误"
    },
    {
        code: 4008,
        reason: "发送 payload 过快，请重新连接，并遵守连接后返回的频控信息",
        resume: true
    },
    {
        code: 4009,
        reason: "连接过期，请重连",
        resume: true
    },
    {
        code: 4010,
        reason: "无效的shard"
    },
    {
        code: 4011,
        reason: "连接需要处理的guild过多，请进行合理分片"
    },
    {
        code: 4012,
        reason: "无效的version"
    },
    {
        code: 4013,
        reason: "无效的intent"
    },
    {
        code: 4014,
        reason: "intent无权限"
    },
    {
        code: 4900,
        reason: "内部错误，请重连"
    },
    {
        code: 4914,
        reason: "机器人已下架,只允许连接沙箱环境,请断开连接,检验当前连接环境"
    },
    {
        code: 4915,
        reason: "机器人已封禁,不允许连接,请断开连接,申请解封后再连接"
    }
];
var Intends;
(function (Intends) {
    Intends[Intends["GUILDS"] = 1] = "GUILDS";
    Intends[Intends["GUILD_MEMBERS"] = 2] = "GUILD_MEMBERS";
    Intends[Intends["GUILD_MESSAGES"] = 512] = "GUILD_MESSAGES";
    Intends[Intends["GUILD_MESSAGE_REACTIONS"] = 1024] = "GUILD_MESSAGE_REACTIONS";
    Intends[Intends["DIRECT_MESSAGE"] = 4096] = "DIRECT_MESSAGE";
    Intends[Intends["OPEN_FORUMS_EVENTS"] = 262144] = "OPEN_FORUMS_EVENTS";
    Intends[Intends["AUDIO_OR_LIVE_CHANNEL_MEMBERS"] = 524288] = "AUDIO_OR_LIVE_CHANNEL_MEMBERS";
    // GROUP_MESSAGE_CREATE = 1 << 24, // 群聊消息事件,现仍然是1 << 25 --2026.5.11
    Intends[Intends["GROUP_MEMBER"] = 16777216] = "GROUP_MEMBER"; /// 用户进退群事件，1<<24
    Intends[Intends["GROUP_MESSAGE_CREATE"] = 33554432] = "GROUP_MESSAGE_CREATE";
    Intends[Intends["C2C_MESSAGE_CREATE"] = 33554432] = "C2C_MESSAGE_CREATE";
    Intends[Intends["GROUP_AT_MESSAGE_CREATE"] = 33554432] = "GROUP_AT_MESSAGE_CREATE";
    Intends[Intends["INTERACTION"] = 67108864] = "INTERACTION";
    Intends[Intends["MESSAGE_AUDIT"] = 134217728] = "MESSAGE_AUDIT";
    Intends[Intends["FORUMS_EVENTS"] = 268435456] = "FORUMS_EVENTS";
    Intends[Intends["AUDIO_ACTIONS"] = 536870912] = "AUDIO_ACTIONS";
    Intends[Intends["PUBLIC_GUILD_MESSAGES"] = 1073741824] = "PUBLIC_GUILD_MESSAGES";
})(Intends || (exports.Intends = Intends = {}));
var ChannelType;
(function (ChannelType) {
    ChannelType[ChannelType["Content"] = 0] = "Content";
    ChannelType[ChannelType["Record"] = 2] = "Record";
    ChannelType[ChannelType["ChannelGroup"] = 4] = "ChannelGroup";
    ChannelType[ChannelType["Live"] = 10005] = "Live";
    ChannelType[ChannelType["App"] = 10006] = "App";
    ChannelType[ChannelType["Forms"] = 10007] = "Forms";
})(ChannelType || (exports.ChannelType = ChannelType = {}));
var ChannelSubType;
(function (ChannelSubType) {
    ChannelSubType[ChannelSubType["Chat"] = 0] = "Chat";
    ChannelSubType[ChannelSubType["Announces"] = 1] = "Announces";
    ChannelSubType[ChannelSubType["Strategy"] = 2] = "Strategy";
    ChannelSubType[ChannelSubType["Black"] = 3] = "Black";
})(ChannelSubType || (exports.ChannelSubType = ChannelSubType = {}));
var PrivateType;
(function (PrivateType) {
    PrivateType[PrivateType["Public"] = 0] = "Public";
    PrivateType[PrivateType["Admin"] = 1] = "Admin";
    PrivateType[PrivateType["Some"] = 2] = "Some";
})(PrivateType || (exports.PrivateType = PrivateType = {}));
var SpeakPermission;
(function (SpeakPermission) {
    SpeakPermission[SpeakPermission["All"] = 1] = "All";
    SpeakPermission[SpeakPermission["Some"] = 2] = "Some";
})(SpeakPermission || (exports.SpeakPermission = SpeakPermission = {}));
var InteractionType;
(function (InteractionType) {
    InteractionType[InteractionType["INLINE_KEYBOARD"] = 11] = "INLINE_KEYBOARD";
    InteractionType[InteractionType["CALLBACK_COMMAND"] = 12] = "CALLBACK_COMMAND";
    InteractionType[InteractionType["MESSAGE_FEEDBACK"] = 13] = "MESSAGE_FEEDBACK";
    InteractionType[InteractionType["CLEAR_SESSION"] = 14] = "CLEAR_SESSION";
    InteractionType[InteractionType["IN_OUT_STORY"] = 15] = "IN_OUT_STORY";
    InteractionType[InteractionType["SWITCH_MODEL"] = 16] = "SWITCH_MODEL";
    InteractionType[InteractionType["USER_AUTHORIZE"] = 18] = "USER_AUTHORIZE";
    InteractionType[InteractionType["GROUP_AUTHORIZE"] = 19] = "GROUP_AUTHORIZE";
    InteractionType[InteractionType["GROUP_AUTHORIZE_STATUS"] = 20] = "GROUP_AUTHORIZE_STATUS";
})(InteractionType || (exports.InteractionType = InteractionType = {}));
var InteractionCode;
(function (InteractionCode) {
    InteractionCode[InteractionCode["SUCCESS"] = 0] = "SUCCESS";
    InteractionCode[InteractionCode["FAILED"] = 1] = "FAILED";
    InteractionCode[InteractionCode["TOO_FREQUENT"] = 2] = "TOO_FREQUENT";
    InteractionCode[InteractionCode["DUPLICATE"] = 3] = "DUPLICATE";
    InteractionCode[InteractionCode["NO_PERMISSION"] = 4] = "NO_PERMISSION";
    InteractionCode[InteractionCode["ADMIN_ONLY"] = 5] = "ADMIN_ONLY";
})(InteractionCode || (exports.InteractionCode = InteractionCode = {}));
exports.InteractionTypeText = {
    11: '消息按钮回调',
    12: '快捷菜单回调',
    13: '消息反馈',
    14: '清空会话',
    15: '进出故事集',
    16: '切换模型',
    18: '用户授权',
    19: '群授权',
    20: '群授权状态变更',
};
exports.NeedReplyTypes = [
    11,
    12
]
exports.InOutStoryActionType = {
    ENTER_STORY: '进入',
    QUIT_STORY: '退出',
};
exports.AuthorizeOptScope = {
    setting: '资料页设置',
    dialog: '弹窗授权'
}
exports.AuthorizeScope = {
    c2c_push: '私信主动消息推送',
    group_push: '群主动消息推送'
}
exports.FriendSceneType = {
    1000:'缺省默认值',
    1001:'网络搜索（全部tab）',
    1002:'网络搜索（机器人tab）',
    1003:'群场景',
    1004:'空间场景',
    2001:'站内分享资料页',
    2002:'站外分享资料页',
    2003:'开发者生成的分享链接（站内）',
    2004:'开发者生成的分享链接（站外）'
}