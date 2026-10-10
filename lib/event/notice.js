const _1 = require("..");
class NoticeEvent {
    constructor(bot, payload) {
        this.bot = bot;
        this.raw = payload.raw;
        const ts = typeof payload.timestamp === 'number'
            ? (payload.timestamp < 1e12 ? payload.timestamp * 1e3 : payload.timestamp)
            : payload.timestamp
        this.timestamp =  new Date(ts).getTime() / 1000;
    }
}
exports.NoticeEvent = NoticeEvent;
class ActionNoticeEvent extends NoticeEvent {
    constructor(bot, payload) {
        super(bot, payload);
        this.replied = false;
        this.sub_type = 'action';
        this.event_id = payload.event_id;
        this.notice_id = payload.id;
        this.data = payload.data;
    }
    /**
     * 回应操作
     * @param code {0|1|2|3|4|5} 结果编码，释义见官网，默认0
     */
    async reply(code = 0, opt={}) {
        if (this.replied)
            return true;
        this.replied = true;
        return this.bot.replyAction(this.notice_id, code, opt);
    }
}
exports.ActionNoticeEvent = ActionNoticeEvent;
class FriendActionNoticeEvent extends ActionNoticeEvent {
    constructor(bot, payload) {
        super(bot, payload);
        this.notice_type = 'friend';
        this.operator_id = payload.user_openid;
        this.event_id = payload.event_id;
        bot.emit(`notice.${this.notice_type}`, this);
        bot.emit(`notice.${this.notice_type}.action`, this);
        bot.logger.info(`好友${this.operator_id} 点击了消息按钮：${this.data.resolved.button_id}`);
    }
}
exports.FriendActionNoticeEvent = FriendActionNoticeEvent;
class GroupActionNoticeEvent extends ActionNoticeEvent {
    constructor(bot, payload) {
        super(bot, payload);
        this.notice_type = 'group';
        this.group_id = payload.group_openid;
        this.operator_id = payload.group_member_openid;
        this.event_id = payload.event_id;
        bot.emit(`notice.${this.notice_type}`, this);
        bot.emit(`notice.${this.notice_type}.action`, this);
        bot.logger.info(`群(${this.group_id})成员${this.operator_id} 点击了消息按钮：${this.data.resolved.button_id}`);
    }
}
exports.GroupActionNoticeEvent = GroupActionNoticeEvent;
class GuildActionNoticeEvent extends ActionNoticeEvent {
    constructor(bot, payload) {
        super(bot, payload);
        this.notice_type = 'guild';
        this.guild_id = payload.guild_id;
        this.channel_id = payload.channel_id;
        this.operator_id = payload.data.resoloved.user_id;
        bot.emit(`notice.${this.notice_type}`, this);
        bot.emit(`notice.${this.notice_type}.action`, this);
        bot.logger.info(`频道(${this.guild_id})成员${this.operator_id}在子频道(${this.channel_id})点击了消息按钮：${this.data.resolved.button_id}`);
    }
}
exports.GuildActionNoticeEvent = GuildActionNoticeEvent;
(function (ActionNoticeEvent) {
    ActionNoticeEvent.parse = function (event, payload) {
        switch (payload.scene) {
            case "c2c":
                return new FriendActionNoticeEvent(this, payload);
            case "group":
                return new GroupActionNoticeEvent(this, payload);
            case "guild":
                return new GuildActionNoticeEvent(this, payload);
        }
    };
})(ActionNoticeEvent || (exports.ActionNoticeEvent = ActionNoticeEvent = {}));

class GroupMember extends NoticeEvent {
    constructor(bot, payload) {
        super(bot, payload);
        this.event_id = payload.event_id;
        this.notice_type = 'group';
        this.group_id = payload.group_openid;
        this.user_id = payload.member_openid;
    }
}
exports.GroupMember = GroupMember;

class GroupMemberAdd extends GroupMember {
    constructor(bot, payload) {
        super(bot, payload);
        this.sub_type = 'increase'
        bot.logger.info(`群[${this.group_id}]用户(${this.user_id})加入`);
    }
}

class GroupMemberRemove extends GroupMember {
    constructor(bot, payload) {
        super(bot, payload);
        this.sub_type = 'decrease'
        bot.logger.info(`群[${this.group_id}]用户(${this.user_id})退出`);
    }
}

(function (GroupMember) {
    GroupMember.parse = function (event, payload) {
        switch(payload.raw.t){
            case 'GROUP_MEMBER_ADD': 
                return new GroupMemberAdd(this, payload);
            case 'GROUP_MEMBER_REMOVE':
                return new GroupMemberRemove(this, payload);

        }
    };
})(GroupMember || (exports.GroupMember = GroupMember = {}));

class MessageAuditEvent extends NoticeEvent {
    constructor(bot, payload) {
        super(bot, payload);
        this.sub_type = 'audit';
        this.audit_id = payload.audit_id
        this.event_id = payload.event_id;
        if(payload.group_openid) {
            this.notice_type = 'group';
            this.group_id = payload.group_openid;
        }
        if(payload.guild_id) {
            this.notice_type = 'guild';
            this.guild_id = payload.guild_id;
        }
        if(payload.openid) {
            this.notice_type = 'friend';
            this.user_id = payload.openid;
        }
        this.audit_time = payload.audit_time;
        this.time = Math.floor(payload.timestamp / 1000);
    }
}
exports.MessageAuditEvent = MessageAuditEvent;

class MessageAuditPass extends MessageAuditEvent {
    constructor(bot, payload) {
        super(bot, payload);
        this.message_id = payload.message_id;
        bot.logger.info(`${payload.group_openid ? `群[${payload.group_openid}]` : ''}消息${payload.message_id}(audit_id:${payload.audit_id})审核通过`);
    }
}

class MessageAuditReject extends MessageAuditEvent {
    constructor(bot, payload) {
        super(bot, payload);
        bot.logger.info(`${payload.group_openid ? `群[${payload.group_openid}]` : ''}消息审核未通过`);
    }
}

(function (MessageAuditEvent) {
    MessageAuditEvent.parse = function (event, payload) {
        switch(payload.raw.t){
            case 'MESSAGE_AUDIT_PASS':
                return new MessageAuditPass(this, payload);
            case 'MESSAGE_AUDIT_REJECT':
                return new MessageAuditReject(this, payload);

        }
    };
})(MessageAuditEvent || (exports.MessageAuditEvent = MessageAuditEvent = {}));

class GroupJoinRequest extends NoticeEvent {
    constructor(bot, payload) {
        super(bot, payload);
        this.notice_type = 'group';
        this.group_id = payload.group_openid;
        this.join_request_id = payload.join_request_id;
        this.user_id = payload.member_openid;
        this.user_name = payload.username;
        this.event_id = payload.event_id;
        this.apply_source = payload.apply_source;
        this.invited_by = payload.invited_by ? payload.invited_by : undefined
        this.verify_info = payload.verify_info;
        this.timestamp = Math.floor(new Date(payload.apply_at).getTime() / 1000);
        bot.logger.info(`群[${this.group_id}]用户[${this.user_name}](${this.user_id})申请加入`);
    }
}
exports.GroupJoinRequest = GroupJoinRequest;
(function (GroupJoinRequest) {
    GroupJoinRequest.parse = function (event, payload) {
        return new GroupJoinRequest(this, payload);
    };
})(GroupJoinRequest || (exports.GroupJoinRequest = GroupJoinRequest = {}));

class FriendReceiveNoticeEvent extends NoticeEvent {
    get actionText() {
        return this.sub_type === `receive_open` ? '开启' : '关闭';
    }
    constructor(bot, sub_type, payload) {
        super(bot, payload);
        this.notice_type = 'friend';
        this.sub_type = sub_type;
        this.user_id = payload.openid;
        this.time = Math.floor(payload.timestamp / 1000);
        bot.logger.info(`好友${this.actionText}主动消息接收：${this.user_id}`);
    }
}
exports.FriendReceiveNoticeEvent = FriendReceiveNoticeEvent;
(function (FriendReceiveNoticeEvent) {
    FriendReceiveNoticeEvent.parse = function (event, payload) {
        switch (event) {
            case "notice.friend.receive_open":
                return new FriendReceiveNoticeEvent(this, 'receive_open', payload);
            case "notice.friend.receive_close":
                return new FriendReceiveNoticeEvent(this, 'receive_close', payload);
        }
    };
})(FriendReceiveNoticeEvent || (exports.FriendReceiveNoticeEvent = FriendReceiveNoticeEvent = {}));
class FriendChangeNoticeEvent extends NoticeEvent {
    get actionText() {
        return this.sub_type === `increase` ? '新增' : '减少';
    }
    constructor(bot, sub_type, payload) {
        super(bot, payload);
        this.notice_type = 'friend';
        this.sub_type = sub_type;
        this.user_id = payload.openid;
        this.event_id = payload.event_id
        this.author = payload.author || {}
        this.scene = payload.scene || ''
        this.scene_param = payload.scene_param || ''
        this.scene_type = {1000:'缺省默认值',1001:'网络搜索（全部tab）',1002:'网络搜索（机器人tab）',1003:'群场景',1004:'空间场景',2001:'站内分享资料页',2002:'站外分享资料页',2003:'开发者生成的分享链接（站内）',2004:'开发者生成的分享链接（站外）'}
        this.time = Math.floor(payload.timestamp / 1000);
        bot.logger.info(`好友${this.actionText}：${this.user_id}`);
    }
}
exports.FriendChangeNoticeEvent = FriendChangeNoticeEvent;
(function (FriendChangeNoticeEvent) {
    FriendChangeNoticeEvent.parse = function (event, payload) {
        switch (event) {
            case "notice.friend.increase":
                return new FriendChangeNoticeEvent(this, 'increase', payload);
            case "notice.friend.decrease":
                return new FriendChangeNoticeEvent(this, 'decrease', payload);
        }
    };
})(FriendChangeNoticeEvent || (exports.FriendChangeNoticeEvent = FriendChangeNoticeEvent = {}));
class GroupReceiveNoticeEvent extends NoticeEvent {
    get actionText() {
        return this.sub_type === `receive_open` ? '开启' : '关闭';
    }
    constructor(bot, sub_type, payload) {
        super(bot, payload);
        this.notice_type = 'group';
        this.sub_type = sub_type;
        this.group_id = payload.group_openid;
        this.operator_id = payload.op_member_openid;
        this.time = Math.floor(payload.timestamp / 1000);
        bot.logger.info(`群${this.actionText}主动消息接收：${this.group_id}. 操作人：${this.operator_id}`);
    }
}
exports.GroupReceiveNoticeEvent = GroupReceiveNoticeEvent;
(function (GroupReceiveNoticeEvent) {
    GroupReceiveNoticeEvent.parse = function (event, payload) {
        switch (event) {
            case "notice.group.receive_open":
                return new GroupReceiveNoticeEvent(this, 'receive_open', payload);
            case "notice.group.receive_close":
                return new GroupReceiveNoticeEvent(this, 'receive_close', payload);
        }
    };
})(GroupReceiveNoticeEvent || (exports.GroupReceiveNoticeEvent = GroupReceiveNoticeEvent = {}));
class GroupChangeNoticeEvent extends NoticeEvent {
    get actionText() {
        return this.sub_type === `add` ? '新增' : '减少';
    }
    constructor(bot, sub_type, payload) {
        super(bot, payload);
        this.notice_type = 'group';
        this.sub_type = sub_type;
        this.group_id = payload.group_openid;
        this.event_id = payload.event_id
        this.operator_id = payload.op_member_openid;
        this.time = Math.floor(payload.timestamp / 1000);
        bot.logger.info(`群${this.actionText}：${this.group_id}. 操作人：${this.operator_id}`);
    }
}
exports.GroupChangeNoticeEvent = GroupChangeNoticeEvent;
(function (GroupChangeNoticeEvent) {
    GroupChangeNoticeEvent.parse = function (event, payload) {
        switch (event) {
            case "notice.group.add":
                return new GroupChangeNoticeEvent(this, 'add', payload);
            case "notice.group.del":
                return new GroupChangeNoticeEvent(this, 'del', payload);
        }
    };
})(GroupChangeNoticeEvent || (exports.GroupChangeNoticeEvent = GroupChangeNoticeEvent = {}));
class GuildChangeNoticeEvent extends NoticeEvent {
    get actionText() {
        return this.sub_type === `increase` ? '新增' : this.sub_type === `update` ? '更新' : '减少';
    }
    constructor(bot, sub_type, payload) {
        super(bot, payload);
        this.notice_type = 'guild';
        this.sub_type = sub_type;
        this.guild_id = payload.id;
        this.guild_name = payload.name;
        this.operator_id = payload.op_user_id;
        this.time = Math.floor(new Date(payload.joined_at).getTime() / 1000);
        bot.logger.info(`频道[${this.guild_name}]${this.actionText}：${this.guild_id}. 操作人：${this.operator_id}`);
    }
}
exports.GuildChangeNoticeEvent = GuildChangeNoticeEvent;
(function (GuildChangeNoticeEvent) {
    GuildChangeNoticeEvent.parse = function (event, payload) {
        switch (event) {
            case "notice.guild.increase":
                return new GuildChangeNoticeEvent(this, 'increase', payload);
            case "notice.guild.update":
                return new GuildChangeNoticeEvent(this, 'update', payload);
            case "notice.guild.decrease":
                return new GuildChangeNoticeEvent(this, 'decrease', payload);
        }
    };
})(GuildChangeNoticeEvent || (exports.GuildChangeNoticeEvent = GuildChangeNoticeEvent = {}));
class ChannelChangeNoticeEvent extends NoticeEvent {
    get actionText() {
        switch (this.sub_type) {
            case 'increase':
                return '新增';
            case 'update':
                return '更新';
            case 'decrease':
                return '减少';
            case "enter":
                return '进入';
            case "exit":
                return '离开';
        }
    }
    constructor(bot, sub_type, payload) {
        super(bot, payload);
        this.notice_type = 'channel';
        this.sub_type = sub_type;
        this.guild_id = payload.guild_id;
        this.channel_id = payload.channel_id || payload.id;
        this.channel_type = payload.channel_type || 0;
        this.channel_name = payload.channel_name || payload.name;
        this.operator_id = payload.op_user_id || payload.user_id;
        this.time = Math.floor(new Date(payload.joined_at).getTime() / 1000);
        bot.logger.info(`${this.actionText}：${this.guild_id}. 操作人：`);
        if (['enter', 'exit'].includes(this.sub_type)) {
            bot.logger.info(`用户${this.actionText}子频道：[${this.channel_name}]${this.channel_id}`);
        }
        else {
            bot.logger.info(`子频道${this.actionText}：[${this.channel_name}]${this.channel_id}. 操作人：${this.operator_id}`);
        }
    }
}
exports.ChannelChangeNoticeEvent = ChannelChangeNoticeEvent;
(function (ChannelChangeNoticeEvent) {
    ChannelChangeNoticeEvent.parse = function (event, payload) {
        switch (event) {
            case "notice.channel.increase":
                return new ChannelChangeNoticeEvent(this, 'increase', payload);
            case "notice.channel.update":
                return new ChannelChangeNoticeEvent(this, 'update', payload);
            case "notice.channel.decrease":
                return new ChannelChangeNoticeEvent(this, 'decrease', payload);
            case "notice.channel.enter":
                return new ChannelChangeNoticeEvent(this, 'enter', payload);
            case "notice.channel.exit":
                return new ChannelChangeNoticeEvent(this, 'exit', payload);
        }
    };
})(ChannelChangeNoticeEvent || (exports.ChannelChangeNoticeEvent = ChannelChangeNoticeEvent = {}));
class GuildMemberChangeNoticeEvent extends NoticeEvent {
    get actionText() {
        return this.sub_type === `member.increase` ? '加入' : this.sub_type === 'member.update' ? '变更' : '退出';
    }
    constructor(bot, sub_type, payload) {
        super(bot, payload);
        this.notice_type = 'guild';
        this.sub_type = sub_type;
        this.guild_id = payload.guild_id;
        this.operator_id = payload.op_user_id;
        this.time = Math.floor(new Date(payload.joined_at).getTime() / 1000);
        this.user_id = payload.user.id;
        this.user_name = payload.user.username;
        this.is_bot = payload.user.bot;
        this.avatar = payload.user.avatar;
        /*this.bot.getGuildAccessApis(this.guild_id).then(result => {
            bot.logger.info(result)
        })*/ //使用新的腾讯skill加入的频道基本没有权限
        /*this.bot.getGuildInfo(this.guild_id).then(result => {
            this.guild = result
            bot.logger.info(`频道[${this.guild.guild_name}](${this.guild_id})${this.is_bot ? '机器人': '成员'}[${this.user_name}](${this.user_id})${this.actionText}. 操作人：${this.operator_id}`);
        })
        */ //使用新的腾讯skill加入的频道基本没有权限
        this.bot.getGuildList().then(list => {
            this.guild = list.find(guild => guild.guild_id === this.guild_id)
            bot.logger.info(`频道[${this.guild.guild_name}](${this.guild_id})${this.is_bot ? '机器人': '成员'}[${this.user_name}](${this.user_id})${this.actionText}. 操作人：${this.operator_id}`);
        });
    }
}
exports.GuildMemberChangeNoticeEvent = GuildMemberChangeNoticeEvent;
(function (GuildMemberChangeNoticeEvent) {
    const recentIncreases = new Map();
    GuildMemberChangeNoticeEvent.parse = function (event, payload) {
        const userId = payload.user.id;
        const guildId = payload.guild_id;
        const key = `${guildId}:${userId}`;

        switch (event) {
            case "notice.guild.member.increase":
                recentIncreases.set(key, Date.now());
                setTimeout(() => recentIncreases.delete(key), 1000);
                return new GuildMemberChangeNoticeEvent(this, 'member.increase', payload);
            case "notice.guild.member.update": //重复事件过滤，设置update事件延迟，以免传入update早于increase
                setTimeout(() => {
                    const increaseTime = recentIncreases.get(key);
                    if (!increaseTime) {
                        new GuildMemberChangeNoticeEvent(this, 'member.update', payload);
                    }
                }, 300);
                return null
            case "notice.guild.member.decrease":
                return new GuildMemberChangeNoticeEvent(this, 'member.decrease', payload);
        }
    };
})(GuildMemberChangeNoticeEvent || (exports.GuildMemberChangeNoticeEvent = GuildMemberChangeNoticeEvent = {}));
class ForumNoticeEvent extends NoticeEvent {
    constructor(bot, payload) {
        super(bot, payload);
        this.notice_type = 'forum';
        this.guild_id = payload.guild_id;
        this.channel_id = payload.channel_id;
        this.author_id = payload.author_id;
    }
}
exports.ForumNoticeEvent = ForumNoticeEvent;
(function (ForumNoticeEvent) {
    ForumNoticeEvent.parse = function (event, payload) {
        switch (event) {
            case "notice.forum":
                const noticeEvent = new ForumNoticeEvent(this, payload);
                this.logger.info(`用户:${noticeEvent.author_id}操作了论坛内容`);
                return noticeEvent;
            case "notice.forum.thread.create":
                return new ThreadChangeNoticeEvent(this, 'create', payload);
            case "notice.forum.thread.update":
                return new ThreadChangeNoticeEvent(this, 'update', payload);
            case "notice.forum.thread.delete":
                return new ThreadChangeNoticeEvent(this, 'delete', payload);
            case "notice.forum.post.create":
                return new PostChangeNoticeEvent(this, 'create', payload);
            case "notice.forum.post.delete":
                return new ThreadChangeNoticeEvent(this, 'delete', payload);
            case "notice.forum.reply.create":
                return new ReplyChangeNoticeEvent(this, 'create', payload);
            case "notice.forum.reply.delete":
                return new ReplyChangeNoticeEvent(this, 'create', payload);
            case "notice.forum.audit":
                return new AuditNoticeEvent(this, payload);
        }
    };
})(ForumNoticeEvent || (exports.ForumNoticeEvent = ForumNoticeEvent = {}));
class ThreadChangeNoticeEvent extends ForumNoticeEvent {
    get actionText() {
        return this.sub_type === 'thread.create' ? '创建' : this.sub_type === 'thread.update' ? '更新' : '删除';
    }
    constructor(bot, sub_type, payload) {
        super(bot, payload);
        this.sub_type = `thread.${sub_type}`;
        this.thread_id = payload.thread_info.thread_id;
        this.title = payload.thread_info.title;
        this.content = payload.thread_info.content;
        this.time = Math.floor(new Date(payload.thread_info.date_time).getTime() / 1000);
        bot.logger.info(`用户${this.author_id}${this.actionText}了主题(${this.thread_id})`);
    }
}
exports.ThreadChangeNoticeEvent = ThreadChangeNoticeEvent;
class PostChangeNoticeEvent extends ForumNoticeEvent {
    get actionText() {
        return this.sub_type === 'post.create' ? '发布' : '删除';
    }
    constructor(bot, sub_type, payload) {
        super(bot, payload);
        this.sub_type = `post.${sub_type}`;
        this.thread_id = payload.post_info.thread_id;
        this.post_id = payload.post_info.post_id;
        this.content = payload.post_info.content;
        this.time = Math.floor(new Date(payload.post_info.date_time).getTime() / 1000);
        bot.logger.info(`用户${this.author_id}${this.actionText}了帖子(${this.post_id})`);
    }
}
exports.PostChangeNoticeEvent = PostChangeNoticeEvent;
class ReplyChangeNoticeEvent extends ForumNoticeEvent {
    get actionText() {
        return this.sub_type === 'reply.create' ? '创建' : '删除';
    }
    constructor(bot, sub_type, payload) {
        super(bot, payload);
        this.sub_type = `reply.${sub_type}`;
        this.thread_id = payload.reply_info.thread_id;
        this.post_id = payload.reply_info.post_id;
        this.reply_id = payload.reply_info.reply_id;
        this.content = payload.reply_info.content;
        this.time = Math.floor(new Date(payload.reply_info.date_time).getTime() / 1000);
        bot.logger.info(`用户${this.author_id})${this.actionText}了回复(${this.reply_id})`);
    }
}
exports.ReplyChangeNoticeEvent = ReplyChangeNoticeEvent;
class AuditNoticeEvent extends ForumNoticeEvent {
    get typeText() {
        if (this.type === _1.AuditType.Thread)
            return '主题';
        if (this.type === _1.AuditType.Post)
            return '帖子';
        if (this.type === _1.AuditType.Reply)
            return '回复';
    }
    constructor(bot, payload) {
        super(bot, payload);
        this.sub_type = 'audit';
        this.thread_id = payload.thread_id;
        this.post_id = payload.post_id;
        this.reply_id = payload.reply_id;
        this.type = payload.type;
        this.result = payload.result;
        this.message = payload.err_msg;
        bot.logger.info(`${this.typeText}审核${this.result === 0 ? '通过' : '拒绝'}. ${this.message || ''}`);
    }
}
exports.AuditNoticeEvent = AuditNoticeEvent;
