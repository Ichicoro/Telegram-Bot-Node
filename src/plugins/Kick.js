const Plugin = require("./../Plugin");

function getTarget(message, args) {
    if (args.length > 1)
        return "Please specify at most one username/ID.";
    if (args.length === 1)
        return Number(args[0]);
    if (message.reply_to_message) {
        if (message.reply_to_message.new_chat_participant)
            return message.reply_to_message.new_chat_participant.id;
        if (message.reply_to_message.left_chat_participant)
            return message.reply_to_message.left_chat_participant.id;
        return message.reply_to_message.from.id;
    }
    return "Please specify an username/ID, or reply to a message with /kick or /ban.";
}

module.exports = class Kick extends Plugin {

    static get plugin() {
        return {
            name: "Kick",
            description: "Kicks users",
            help: "Reply with /kick or /ban, or send /[kick|ban] ID."
        };
    }

    constructor(obj) {
        super(obj);

        this.auth = obj.auth;
    }

    get commands() {
        return {
            banlist: ({message}) => {
                const chatID = message.chat.id;
                if (!this.db[chatID])
                    return "Empty.";
                return JSON.stringify(this.db[message.chat.id]);
            },
            kick: ({message, args}) => {
                if (!this.auth.isMod(message.from.id))
                    return "Insufficient privileges.";
                const target = getTarget(message, args);
                if (typeof target === "string") return target;
                if (this.auth.isMod(target, message.chat.id))
                    return "Can't kick mods or admins (demote the target first).";
                this.kick(message, target);
                return "Kicked.";
            },
            ban: ({message, args}) => {
                if (!this.auth.isMod(message.from.id))
                    return "Insufficient privileges.";
                const target = getTarget(message, args);
                if (typeof target === "string") return target;
                if (this.auth.isMod(target, message.chat.id))
                    return "Can't ban mods or admins (demote the target first).";
                this.ban(message, target);
                this.kick(message, target);
                return "Banned.";
            },
            pardon: ({message, args}) => {
                if (!this.auth.isMod(message.from.id))
                    return "Insufficient privileges.";
                const target = getTarget(message, args);
                if (typeof target === "string") return target;
                if (!this.db[message.chat.id])
                    return "It seems that there are no banned users.";
                this.db[message.chat.id] = this.db[message.chat.id].filter(id => id !== target);
                return "Pardoned.";
            }
        };
    }

    kick(message, target) {
        this.kickChatMember(message.chat.id, target)
            .catch(err => this.sendMessage(message.chat.id, "An error occurred while kicking the user: " + err));
    }

    // Note that banning does not imply kicking.
    ban(message, target) {
        if (!this.db[message.chat.id])
            this.db[message.chat.id] = [];
        this.db[message.chat.id].push(target);
    }

    onNewChatMembers({message}) {
        const chatID = message.chat.id;
        // If there is no database, nobody was ever banned so far. Return early.
        if (!this.db[chatID]) return;

        for (const member of message.new_chat_members) {
            const target = member.id;
            if (!this.db[chatID].includes(target))
                continue;
            if (this.auth.isMod(target, message.chat.id))
                continue;
            this.kickChatMember(chatID, target)
                .catch(err => this.sendMessage(message.chat.id, "An error occurred while kicking the user: " + err));
        }
    }
};
