const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const router = express.Router();
const pino = require('pino');
const { Octokit } = require('@octokit/rest');
const moment = require('moment-timezone');
const Jimp = require('jimp');
const crypto = require('crypto');
const axios = require('axios');
const yts = require("yt-search");
const fetch = require("node-fetch"); 
const api = `https://api-dark-shan-yt.koyeb.app`;
const apikey = `1c5502363449511f`;
const { initUserEnvIfMissing } = require('./settingsdb');
const { initEnvsettings, getSetting } = require('./settings');
//=======================================
const autoReact = getSetting('AUTO_REACT')|| 'on';

//=======================================
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
    proto,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    downloadMediaMessage
} = require('@whiskeysockets/baileys');
//=======================================
const config = {
    AUTO_VIEW_STATUS: 'true',
    AUTO_LIKE_STATUS: 'true',
    AUTO_RECORDING: 'false',
    AUTO_LIKE_EMOJI: ['🧩', '🍉', '💜', '🌸', '🪴', '💊', '💫', '🍂', '🌟', '🎋', '😶‍🌫️', '🫀', '🧿', '👀', '🤖', '🚩', '🥰', '🗿', '💜', '💙', '🌝'],
    PREFIX: '.',
    MAX_RETRIES: 3,
    GROUP_INVITE_LINK: 'https://chat.whatsapp.com/B6yhKpqsUCu9K2QHxvxD2W? mode=ems_copy_t',
    ADMIN_LIST_PATH: './admin. json',
    IMAGE_PATH: 'https://files.catbox.moe/ph10xh.png',
    NEWSLETTER_JID: '120363423961368163@newsletter',
    NEWSLETTER_MESSAGE_ID: '0088',
    OTP_EXPIRY:  300000,
    NEWS_JSON_URL: '',
    BOT_NAME: 'EF-PRIME-MD-MINI',
    OWNER_NAME: 'Frank Kaumba dev',
    OWNER_NUMBER: '265993702467',
    BOT_VERSION: '1.0.0',
    BOT_FOOTER:  '> Frankkaumbadev 😎',
    CHANNEL_LINK: 'https://whatsapp.com/channel/0029VbBMv2IDeON5eOz38p1M',
    BUTTON_IMAGES: {
        ALIVE: 'https://files.catbox.moe/ph10xh.png',
        MENU: 'https://files.catbox.moe/ph10xh.png',
        OWNER: 'https://files.catbox.moe/ph10xh.png',
        SONG: 'https://files.catbox.moe/ph10xh.png',
        VIDEO: 'https://files.catbox.moe/ph10xh.png'
    }
};

// List Message Generator
function generateListMessage(text, buttonTitle, sections) {
    return {
        text:  text,
        footer: config.BOT_FOOTER,
        title: buttonTitle,
        buttonText: "ꜱᴇʟᴇᴄᴛ",
        sections: sections
    };
}
//=======================================
// Button Message Generator with Image Support
function generateButtonMessage(content, buttons, image = null) {
    const message = {
        text: content,
        footer: config.BOT_FOOTER,
        buttons: buttons,
        headerType: 1 // Default to text header
    };
//=======================================
    // Add image if provided
    if (image) {
        message.headerType = 4; // Image header
        message. image = typeof image === 'string' ? { url: image } : image;
    }

    return message;
}
//=======================================
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
});
const owner = process.env.GITHUB_REPO_OWNER;
const repo = process.env.GITHUB_REPO_NAME;

const activeSockets = new Map();
const socketCreationTime = new Map();
const SESSION_BASE_PATH = './session';
const NUMBER_LIST_PATH = './numbers. json';
const otpStore = new Map();

if (!fs.existsSync(SESSION_BASE_PATH)) {
    fs.mkdirSync(SESSION_BASE_PATH, { recursive:  true });
}
//=======================================
function loadAdmins() {
    try {
        if (fs.existsSync(config.ADMIN_LIST_PATH)) {
            return JSON.parse(fs.readFileSync(config.ADMIN_LIST_PATH, 'utf8'));
        }
        return [];
    } catch (error) {
        console.error('Failed to load admin list:', error);
        return [];
    }
}

function formatMessage(title, content, footer) {
    return `${title}\n\n${content}\n\n${footer}`;
}

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function getSriLankaTimestamp() {
    return moment().tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss');
}

// HELPER FUNCTION FOR FORWARDED MESSAGES FROM CHANNEL
async function sendAsForwarded(socket, sender, content, isImage = false, buttons = null) {
    try {
        const messageObj = {
            forward: {
                key: {
                    remoteJid: config.NEWSLETTER_JID,
                    fromMe: false,
                    id: 'fwd_' + Math.random().toString(36).substring(7)
                }
            }
        };

        if (isImage) {
            messageObj.image = content. image;
            messageObj.caption = content.caption;
            if (buttons) messageObj.buttons = buttons;
        } else {
            messageObj. text = content;
            if (buttons) messageObj.buttons = buttons;
        }

        await socket. sendMessage(sender, messageObj);
    } catch (error) {
        console.error('Forward message error:', error);
        // Fallback to normal message if forward fails
        try {
            if (isImage) {
                await socket.sendMessage(sender, {
                    image: content.image,
                    caption: content.caption,
                    buttons: buttons
                });
            } else {
                await socket.sendMessage(sender, {
                    text: content,
                    buttons: buttons
                });
            }
        } catch (fallbackError) {
            console. error('Fallback message error:', fallbackError);
        }
    }
}

async function cleanDuplicateFiles(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path:  'session'
        });

        const sessionFiles = data.filter(file => 
            file.name.startsWith(`empire_${sanitizedNumber}_`) && file.name.endsWith('.json')
        ).sort((a, b) => {
            const timeA = parseInt(a.name.match(/empire_\d+_(\d+)\.json/)?.[1] || 0);
            const timeB = parseInt(b.name.match(/empire_\d+_(\d+)\.json/)?.[1] || 0);
            return timeB - timeA;
        });

        const configFiles = data.filter(file => 
            file.name === `config_${sanitizedNumber}.json`
        );

        if (sessionFiles.length > 1) {
            for (let i = 1; i < sessionFiles.length; i++) {
                await octokit.repos.deleteFile({
                    owner,
                    repo,
                    path: `session/${sessionFiles[i].name}`,
                    message: `Delete duplicate session file for ${sanitizedNumber}`,
                    sha: sessionFiles[i].sha
                });
                console.log(`Deleted duplicate session file: ${sessionFiles[i].name}`);
            }
        }

        if (configFiles.length > 1) {
            console.log(`Config file for ${sanitizedNumber} already exists`);
        }
    } catch (error) {
        console.error(`Failed to clean duplicate files for ${number}:`, error);
    }
}
//react channel 
async function setupNewsletterHandlers(socket) {
    const emojis = ['❤️', '😍', '🔥', '👍', '😂', '🙌', '💯', '✨', '🎉', '💫', '👏', '😎'];
    
    socket.ev.on('messages. upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key || message.key.remoteJid !== config.NEWSLETTER_JID) return;

        try {
            const messageId = message.newsletterServerId || message.key. id;

            if (!messageId) {
                console.warn('No valid newsletterServerId found:', message);
                return;
            }

            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

            let retries = config.MAX_RETRIES;
            while (retries > 0) {
                try {
                    await socket.newsletterReactMessage(
                        config.NEWSLETTER_JID,
                        messageId. toString(),
                        randomEmoji
                    );
                    console.log(`✅ [AUTO-REACT] Reacted with ${randomEmoji} on message ${messageId}`);
                    break;
                } catch (error) {
                    retries--;
                    console.warn(`Failed to react, retries left: ${retries}`, error.message);
                    if (retries === 0) throw error;
                    await delay(2000 * (config.MAX_RETRIES - retries));
                }
            }
        } catch (error) {
            console.error('Newsletter auto-react error:', error);
        }
    });
}
//=======================================
async function joinGroup(socket) {
    let retries = config.MAX_RETRIES;
    const inviteCodeMatch = config.GROUP_INVITE_LINK.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/);
    if (!inviteCodeMatch) {
        console.error('Invalid group invite link format');
        return { status: 'failed', error: 'Invalid group invite link' };
    }
    const inviteCode = inviteCodeMatch[1];

    while (retries > 0) {
        try {
            const response = await socket.groupAcceptInvite(inviteCode);
            if (response?. gid) {
                console.log(`Successfully joined group with ID: ${response.gid}`);
                return { status: 'success', gid: response.gid };
            }
            throw new Error('No group ID in response');
        } catch (error) {
            retries--;
            let errorMessage = error.message || 'Unknown error';
            if (error.message.includes('not-authorized')) {
                errorMessage = 'Bot is not authorized to join (possibly banned)';
            } else if (error.message.includes('conflict')) {
                errorMessage = 'Bot is already a member of the group';
            } else if (error.message.includes('gone')) {
                errorMessage = 'Group invite link is invalid or expired';
            }
            console. warn(`Failed to join group, retries left: ${retries}`, errorMessage);
            if (retries === 0) {
                return { status: 'failed', error:  errorMessage };
            }
            await delay(2000 * (config.MAX_RETRIES - retries));
        }
    }
    return { status: 'failed', error: 'Max retries reached' };
}
//=======================================
async function sendAdminConnectMessage(socket, number, groupResult) {
    const admins = loadAdmins();
    const groupStatus = groupResult.status === 'success'
        ? `Joined (ID: ${groupResult.gid})`
        : `Failed to join group:  ${groupResult.error}`;
    const caption = formatMessage(
        '*Connected Successful ✅*',
        `📞 Number: ${number}\n🩵 Status: Online`,
        `${config.BOT_FOOTER}`
    );

    for (const admin of admins) {
        try {
            await socket.sendMessage(
                `${admin}@s. whatsapp.net`,
                {
                    image: { url: config.IMAGE_PATH },
                    caption
                }
            );
        } catch (error) {
            console.error(`Failed to send connect message to admin ${admin}:`, error);
        }
    }
}
//=======================================
async function sendOTP(socket, number, otp) {
    const userJid = jidNormalizedUser(socket.user.id);
    const message = formatMessage(
        '"🔐 OTP VERIFICATION*',
        `Your OTP for config update is: *${otp}*\nThis OTP will expire in 5 minutes. `,
        `${config.BOT_FOOTER}`
    );

    try {
        await socket.sendMessage(userJid, { text: message });
        console.log(`OTP ${otp} sent to ${number}`);
    } catch (error) {
        console.error(`Failed to send OTP to ${number}: `, error);
        throw error;
    }
}
//=======================================
function setupNewsletterHandlers(socket) {
    const emojis = ['❤️', '😍', '🔥', '👍', '😂', '🙌', '💯', '✨', '🎉', '💫', '👏', '😎'];
    
    socket.ev.on('messages. upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?. key || message.key. remoteJid !== config.NEWSLETTER_JID) return;

        try {
            const messageId = message.newsletterServerId || message.key.id;

            if (! messageId) {
                console.warn('No valid newsletterServerId found:', message);
                return;
            }

            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

            let retries = config.MAX_RETRIES;
            while (retries > 0) {
                try {
                    await socket.newsletterReactMessage(
                        config.NEWSLETTER_JID,
                        messageId. toString(),
                        randomEmoji
                    );
                    console.log(`✅ Reacted to newsletter with ${randomEmoji}`);
                    break;
                } catch (error) {
                    retries--;
                    console.warn(`Failed to react to newsletter, retries left: ${retries}`, error.message);
                    if (retries === 0) throw error;
                    await delay(2000 * (config.MAX_RETRIES - retries));
                }
            }
        } catch (error) {
            console.error('Newsletter auto-react error:', error);
        }
    });
}
//=======================================
async function setupStatusHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (! message?.key || message.key. remoteJid !== 'status@broadcast' || !message.key.participant || message.key.remoteJid === config.NEWSLETTER_JID) return;

        try {
            if (autoReact === 'on' && message.key.remoteJid) {
                await socket.sendPresenceUpdate("recording", message.key.remoteJid);
            }

            if (config.AUTO_VIEW_STATUS === 'true') {
                let retries = config.MAX_RETRIES;
                while (retries > 0) {
                    try {
                        await socket.readMessages([message.key]);
                        break;
                    } catch (error) {
                        retries--;
                        console.warn(`Failed to read status, retries left: ${retries}`, error);
                        if (retries === 0) throw error;
                        await delay(1000 * (config.MAX_RETRIES - retries));
                    }
                }
            }

            if (config.AUTO_LIKE_STATUS === 'true') {
                const randomEmoji = config.AUTO_LIKE_EMOJI[Math.floor(Math.random() * config.AUTO_LIKE_EMOJI.length)];
                let retries = config.MAX_RETRIES;
                while (retries > 0) {
                    try {
                        await socket.sendMessage(
                            message.key. remoteJid,
                            { react: { text: randomEmoji, key: message.key } },
                            { statusJidList: [message.key.participant] }
                        );
                        console.log(`Reacted to status with ${randomEmoji}`);
                        break;
                    } catch (error) {
                        retries--;
                        console.warn(`Failed to react to status, retries left: ${retries}`, error);
                        if (retries === 0) throw error;
                        await delay(1000 * (config.MAX_RETRIES - retries));
                    }
                }
            }
        } catch (error) {
            console.error('Status handler error:', error);
        }
    });
}
//=======================================
async function handleMessageRevocation(socket, number) {
    socket.ev.on('messages.delete', async ({ keys }) => {
        if (!keys || keys.length === 0) return;

        const messageKey = keys[0];
        const userJid = jidNormalizedUser(socket.user.id);
        const deletionTime = getSriLankaTimestamp();
        
        const message = formatMessage(
            '╭──◯',
            `│ \`D E L E T E\`\n│ *⦁ From : * ${messageKey.remoteJid}\n│ *⦁ Time: * ${deletionTime}\n│ *⦁ Type:  Normal*\n╰──◯`,
            `${config.BOT_FOOTER}`
        );

        try {
            await socket.sendMessage(userJid, {
                image: { url: config.IMAGE_PATH },
                caption: message
            });
            console.log(`Notified ${number} about message deletion:  ${messageKey.id}`);
        } catch (error) {
            console.error('Failed to send deletion notification:', error);
        }
    });
}

// Image resizing function
async function resize(image, width, height) {
    let oyy = await Jimp.read(image);
    let kiyomasa = await oyy.resize(width, height).getBufferAsync(Jimp. MIME_JPEG);
    return kiyomasa;
}

// Capitalize first letter
function capital(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Generate serial
const createSerial = (size) => {
    return crypto.randomBytes(size).toString('hex').slice(0, size);
}

// Send slide with news items
async function SendSlide(socket, jid, newsItems) {
    let anu = [];
    for (let item of newsItems) {
        let imgBuffer;
        try {
            imgBuffer = await resize(item.thumbnail, 300, 200);
        } catch (error) {
            console.error(`Failed to resize image for ${item.title}:`, error);
            imgBuffer = await Jimp.read('https://i.postimg.cc/fbLksDqz/Screenshot-20251005-224142-Whats-App-Business. jpg');
            imgBuffer = await imgBuffer.resize(300, 200).getBufferAsync(Jimp.MIME_JPEG);
        }
        let imgsc = await prepareWAMessageMedia({ image: imgBuffer }, { upload: socket.waUploadToServer });
        anu.push({
            body: proto.Message.InteractiveMessage.Body.fromObject({
                text: `*${capital(item.title)}*\n\n${item.body}`
            }),
            header: proto.Message.InteractiveMessage. Header.fromObject({
                hasMediaAttachment: true,
                ... imgsc
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage. fromObject({
                buttons: [
                    {
                        name: "cta_url",
                        buttonParamsJson: `{"display_text":"𝐃𝙴𝙿𝙻𝙾𝚈","url":"https:/","merchant_url":"https://www.google.com"}`
                    },
                    {
                        name: "cta_url",
                        buttonParamsJson: `{"display_text":"𝐂𝙾𝙽𝚃𝙰𝙲𝚃","url":"https","merchant_url":"https://www.google.com"}`
                    }
                ]
            })
        });
    }
    const msgii = await generateWAMessageFromContent(jid, {
        viewOnceMessage: {
            message: {
                messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2
                },
                interactiveMessage: proto.Message.InteractiveMessage. fromObject({
                    body: proto.Message.InteractiveMessage.Body.fromObject({
                        text: "*Latest News Updates*"
                    }),
                    carouselMessage: proto.Message. InteractiveMessage.CarouselMessage.fromObject({
                        cards: anu
                    })
                })
            }
        }
    }, { userJid: jid });
    return socket.relayMessage(jid, msgii. message, {
        messageId: msgii.key.id
    });
}

// Fetch news from API
async function fetchNews() {
    try {
        const response = await axios.get(config.NEWS_JSON_URL);
        return response.data || [];
    } catch (error) {
        console.error('Failed to fetch news from raw JSON URL:', error. message);
        return [];
    }
}

// Setup command handlers with buttons and images
function setupCommandHandlers(socket, number) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg. message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

        let command = null;
        let args = [];
        let sender = msg.key.remoteJid;

        if (msg.message.conversation || msg.message.extendedTextMessage?. text) {
            const text = (msg.message.conversation || msg.message.extendedTextMessage. text || '').trim();
            if (text.startsWith(config.PREFIX)) {
                const parts = text.slice(config.PREFIX.length).trim().split(/\s+/);
                command = parts[0]. toLowerCase();
                args = parts. slice(1);
            }
        }
        else if (msg.message.buttonsResponseMessage) {
            const buttonId = msg.message.buttonsResponseMessage.selectedButtonId;
            if (buttonId && buttonId.startsWith(config.PREFIX)) {
                const parts = buttonId.slice(config.PREFIX.length).trim().split(/\s+/);
                command = parts[0].toLowerCase();
                args = parts.slice(1);
            }
        }

        if (! command) return;

        try {
            switch (command) {   
                // ALIVE COMMAND
                case 'alive':  {
                    const startTime = socketCreationTime. get(number) || Date.now();
                    const uptime = Math.floor((Date. now() - startTime) / 1000);
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);

                    const title = '*ᴇꜰ-ᴘʀɪᴍᴇ-ᴜʟᴛʀᴀ ᴍɪɴɪ ᴀᴄᴛɪᴠᴇ!!  ❤*';
                    const content = `╭────❒ *🤖 BOT INFO* ❒\n` +
                                    `├⬡ 👨‍💻 *ᴏᴡɴᴇʀ: * ꜰʀᴀɴᴋ ᴋᴀᴜᴍʙᴀ\n` +
                                    `├⬡ 🤖 *ʙᴏᴛ ɴᴀᴍᴇ:* ᴇꜰ-ᴘʀɪᴍᴇ-ᴜʟᴛʀᴀ ᴍɪɴɪ\n` +
                                    `├⬡ 🪢 *ʀᴜɴᴛɪᴍᴇ:* ${hours}h ${minutes}m ${seconds}s\n` +
                                    `├⬡ 🌐 *ᴡᴇʙꜱɪᴛᴇ:* https://ef-prime.com\n` +
                                    `╰────────────❒`;
                    const footer = config.BOT_FOOTER;

                    await sendAsForwarded(socket, sender, {
                        image: { url:  config. BUTTON_IMAGES. ALIVE },
                        caption:  formatMessage(title, content, footer)
                    }, true, [
                        { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: 'MENU' }, type: 1 },
                        { buttonId: `${config.PREFIX}ping`, buttonText: { displayText: 'PING' }, type:  1 }
                    ]);
                    break;
                }

                // MENU COMMAND
                case 'menu': {
                    const startTime = socketCreationTime.get(number) || Date.now();
                    const uptime = Math. floor((Date.now() - startTime) / 1000);
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math. floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);

                    const now = new Date();
                    const date = now.toLocaleDateString('en-GB');
                    const day = now.toLocaleDateString('en-US', { weekday: 'long' });
                    const time = now.toLocaleTimeString('en-GB', { hour12: false });

                    await socket.sendMessage(sender, { 
                        react: { 
                            text: "🤖",
                            key: msg.key 
                        } 
                    });

                    const text = 
`╭─❒ ➣ *EF-PRIME-ULTRA MINI* ❒
├⬡ 👤 User: ${msg.pushName || 'User'}
├⬡ 🆔 ID: @${sender. split('@')[0]}
├⬡ 👑 Status: FREE
├⬡ 🎫 Limit: 100
├⬡ 💰 Money: 10. 000
├⬡ 🌐 Prefix: ${config.PREFIX}
├⬡ 🤖 Bot: EF-PRIME-ULTRA MINI
├⬡ 👨‍💻 Owner: @${config.OWNER_NUMBER}
├⬡ 🔄 Mode: Public
├⬡ 📅 Date: ${date}
├⬡ 📆 Day: ${day}
├⬡ ⏰ Time: ${time} WAT
├⬡ 🪢 Runtime: ${hours}h ${minutes}m ${seconds}s
╰────────────❒

⭐ *PRIME CORE*
├ ${config.PREFIX}alive - show bot information
├ ${config.PREFIX}system - show system details
├ ${config.PREFIX}ping - check bot latency
├ ${config.PREFIX}jid - get chat JID

🎪 *FUN ZONE*
├ ${config.PREFIX}meme - random meme
├ ${config. PREFIX}joke - random joke
├ ${config.PREFIX}fact - random fact
├ ${config.PREFIX}quote - random quote
├ ${config.PREFIX}truth - truth question
├ ${config.PREFIX}dare - dare challenge
├ ${config.PREFIX}wyr - would you rather

📥 *DOWNLOAD HUB*
├ ${config. PREFIX}song - download audio from youtube
├ ${config.PREFIX}video - download video from youtube
├ ${config.PREFIX}play - play song

🎨 *STICKER MAKER*
├ ${config.PREFIX}sticker - convert image/video to sticker

👥 *GROUP MANAGEMENT*
├ ${config.PREFIX}add - add member to group
├ ${config. PREFIX}kick - remove member from group
├ ${config.PREFIX}promote - make member admin
├ ${config. PREFIX}demote - remove admin status
├ ${config.PREFIX}groupinfo - display group info
├ ${config.PREFIX}setgroupname - change group name
├ ${config. PREFIX}setdesc - change group description
├ ${config.PREFIX}lock - lock group (admin only)
├ ${config.PREFIX}unlock - unlock group
├ ${config.PREFIX}antilink <on/off> - toggle antilink
├ ${config.PREFIX}leave - bot leaves group
├ ${config.PREFIX}tagall - tag all members
├ ${config.PREFIX}hidetag - hidden tag message
├ ${config.PREFIX}invite - get group invite link
├ ${config.PREFIX}revoke - revoke invite link

👤 *ACCOUNT MANAGEMENT*
├ ${config.PREFIX}block - block user (owner)
├ ${config.PREFIX}unblock - unblock user (owner)
├ ${config.PREFIX}setbio - update bot bio (owner)
├ ${config.PREFIX}setbotname - update bot name (owner)
├ ${config.PREFIX}setpp - update profile picture (owner)
├ ${config.PREFIX}deletepp - remove profile picture (owner)

🔧 *OTHER COMMANDS*
├ ${config.PREFIX}owner - contact bot owner

╭─────────❒
├⬡ Total Commands: 40+ 
├⬡ Bot Version: EF-PRIME-ULTRA-MINI
├⬡ Current Prefix: ${config.PREFIX}
├⬡ 💡 *TIP: * Use \`${config.PREFIX}help <command>\` for detailed info
╰────────────❒
*EF-PRIME-ULTRA MINI* - Malawian based bot 
https://ef-prime-md-mini-ultra.onrender.com
> 😎 *Frank Kaumba Dev*`;

                    await sendAsForwarded(socket, sender, text, false);
                    break;
                }

                // PING COMMAND
                case 'ping': {     
                    var inital = new Date().getTime();
                    let ping = await socket.sendMessage(sender, { text: '*_Pinging.. ._* 🐥' });
                    var final = new Date().getTime();

                    return await socket.sendMessage(sender, {
                        text: '╭────❒ *EF-PRIME-ULTRA PING* ❒\n├⬡ 🏓 *Speed:* '+ (final - inital) + ' ms\n╰────────────❒', 
                        edit: ping.key 
                    });
                }

                // OWNER COMMAND
                case 'owner': {
                    const vcard = 'BEGIN:VCARD\n'
                        + 'VERSION: 3.0\n' 
                        + 'FN: FRANK KAUMBA\n'
                        + 'ORG:EF-PRIME TECH\n'
                        + 'TEL;type=CELL;type=VOICE;waid=' + config.OWNER_NUMBER + ': +' + config.OWNER_NUMBER + '\n'
                        + 'EMAIL:efkidgamer@gmail.com\n'
                        + 'END: VCARD';

                    await sendAsForwarded(socket, sender, {
                        image: { url:  config. BUTTON_IMAGES.OWNER },
                        caption: '*ᴇꜰ-ᴘʀɪᴍᴇ-ᴜʟᴛʀᴀ ᴍɪɴɪ ʙᴏᴛ ᴏᴡɴᴇʀ ᴅᴇᴛᴀɪʟꜱ*'
                    }, true, [
                        { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: ' ᴍᴇɴᴜ' }, type: 1 },
                        { buttonId: `${config.PREFIX}alive`, buttonText: { displayText: 'ᴮᴼᵀ ᴵᴺᶠᴼ' }, type: 1 }
                    ]);
                    break;     
                }

                // SYSTEM COMMAND
                case 'system': {
                    const startTime = socketCreationTime.get(number) || Date.now();
                    const uptime = Math. floor((Date.now() - startTime) / 1000);
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math. floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);

                    const title = '*ᴇꜰ-ᴘʀɪᴍᴇ-ᴜʟᴛʀᴀ ᴍɪɴɪ ꜱʏꜱᴛᴇᴍ*';
                    const content = `╭────❒ *⚙️ SYSTEM INFO* ❒\n` +
                        `├⬡ 🤖 \`ʙᴏᴛ ɴᴀᴍᴇ\` : ${config.BOT_NAME}\n` +
                        `├⬡ 🔖 \`ᴠᴇʀsɪᴏɴ\` : ${config.BOT_VERSION}\n` +
                        `├⬡ 📡 \`ᴘʟᴀᴛꜰᴏʀᴍ\` : ʀᴇɴᴅᴇʀ\n` +
                        `├⬡ 🪢 \`ʀᴜɴᴛɪᴍᴇ\` : ${hours}h ${minutes}m ${seconds}s\n` +
                        `├⬡ 👨‍💻 \`ᴏᴡɴᴇʀ\` : ${config.OWNER_NAME}\n` +
                        `╰────────────❒`;
                    const footer = config.BOT_FOOTER;

                    await sendAsForwarded(socket, sender, {
                        image: { url: "https://files.catbox.moe/ph10xh.png" },
                        caption: formatMessage(title, content, footer)
                    }, true);
                    break;
                }

                // JID COMMAND
                case 'jid': {
                    await sendAsForwarded(socket, sender, `╭────❒ *🆔 CHAT INFO* ❒\n├⬡ *ᴄʜᴀᴛ ᴊɪᴅ: * ${sender}\n╰────────────❒`, false);
                    break;
                }

                // MEME COMMAND
                case 'meme': {
                    try {
                        const response = await axios.get('https://noobs-api.top/api/meme');
                        const { image, title } = response.data;

                        await sendAsForwarded(socket, sender, {
                            image:  { url: image },
                            caption: `╭────❒ *😂 MEME* ❒\n├⬡ ${title}\n╰────────────❒`
                        }, true);
                    } catch (error) {
                        console.error('Meme error:', error);
                        await sendAsForwarded(socket, sender, '❌ Failed to fetch meme.  Try again! ', false);
                    }
                    break;
                }

                // JOKE COMMAND
                case 'joke': {
                    try {
                        const response = await axios.get('https://noobs-api.top/api/dadjoke');
                        const { joke } = response.data;

                        const text = `╭────❒ *😄 JOKE* ❒\n├⬡ ${joke}\n╰────────────❒`;
                        await sendAsForwarded(socket, sender, text, false);
                    } catch (error) {
                        console.error('Joke error:', error);
                        await sendAsForwarded(socket, sender, '❌ Failed to fetch joke! ', false);
                    }
                    break;
                }

                // FACT COMMAND
                case 'fact': {
                    try {
                        const response = await axios.get('https://noobs-api.top/api/fact');
                        const { fact } = response.data;

                        const text = `╭────❒ *📚 FACT* ❒\n├⬡ ${fact}\n╰────────────❒`;
                        await sendAsForwarded(socket, sender, text, false);
                    } catch (error) {
                        console.error('Fact error:', error);
                        await sendAsForwarded(socket, sender, '❌ Failed to fetch fact!', false);
                    }
                    break;
                }

                // QUOTE COMMAND
                case 'quote': {
                    try {
                        const response = await axios.get('https://noobs-api.top/api/quote');
                        const { quote, author } = response.data;

                        const text = `╭────❒ *💬 QUOTE* ❒\n├⬡ "${quote}"\n├⬡ ~ ${author}\n╰────────────❒`;
                        await sendAsForwarded(socket, sender, text, false);
                    } catch (error) {
                        console.error('Quote error:', error);
                        await sendAsForwarded(socket, sender, '❌ Failed to fetch quote!', false);
                    }
                    break;
                }

                // TRUTH COMMAND
                case 'truth': {
                    try {
                        const response = await axios.get('https://noobs-api.top/api/truth');
                        const { truth } = response.data;

                        const text = `╭────❒ *🎯 TRUTH* ❒\n├⬡ ${truth}\n╰────────────❒`;
                        await sendAsForwarded(socket, sender, text, false);
                    } catch (error) {
                        console.error('Truth error:', error);
                        await sendAsForwarded(socket, sender, '❌ Failed to fetch truth! ', false);
                    }
                    break;
                }

                // DARE COMMAND
                case 'dare': {
                    try {
                        const response = await axios.get('https://noobs-api.top/api/dare');
                        const { dare } = response.data;

                        const text = `╭────❒ *⚡ DARE* ❒\n├⬡ ${dare}\n╰────────────❒`;
                        await sendAsForwarded(socket, sender, text, false);
                    } catch (error) {
                        console.error('Dare error:', error);
                        await sendAsForwarded(socket, sender, '❌ Failed to fetch dare!', false);
                    }
                    break;
                }

                // WYR COMMAND
                case 'wyr': {
                    try {
                        const response = await axios.get('https://noobs-api.top/api/wouldyourather');
                        const { question } = response.data;

                        const text = `╭────❒ *🤔 WOULD YOU RATHER* ❒\n├⬡ ${question}\n╰────────────❒`;
                        await sendAsForwarded(socket, sender, text, false);
                    } catch (error) {
                        console.error('WYR error:', error);
                        await sendAsForwarded(socket, sender, '❌ Failed to fetch question!', false);
                    }
                    break;
                }

                // SONG COMMAND
                case 'song': 
                case 'play': {
                    try {
                        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
                        const q = text.split(" ").slice(1).join(" ").trim();
                        
                        if (! q) {
                            await sendAsForwarded(socket, sender, '╭────❒ *🚫 ERROR* ❒\n├⬡ ᴘʟᴇᴀꜱᴇ ᴇɴᴛᴇʀ ᴀ sᴏɴɢ\n├⬡ ɴᴀᴍᴇ ᴛᴏ sᴇᴀʀᴄʜ.\n╰────────────❒', false);
                            return;
                        }

                        const loadingMsg = `╭─❒ ➢ *EF-PRIME-ULTRA* ❒\n├⬡ 🎵 Searching:  ${q}\n├⬡ ⏳ Processing.. .\n╰────────────❒`;
                        await sendAsForwarded(socket, sender, loadingMsg, false);

                        const searchApiKey = "r-rishad100";
                        const searchUrl = `https://for-devs.ddns.net/api/downloader/youtube/search?apikey=${searchApiKey}&query=${encodeURIComponent(q)}`;
                        
                        const searchResp = await fetch(searchUrl);
                        const searchData = await searchResp. json();
                        
                        if (! searchData || searchData.status !== 'success' || !searchData.data || !searchData.data.length) {
                            await sendAsForwarded(socket, sender, '╭────❒ *🚩 NOT FOUND* ❒\n├⬡ ʀᴇꜱᴜʟᴛ ɴᴏᴛ ꜰᴏᴜɴᴅ\n╰────────────❒', false);
                            return;
                        }
                        
                        const hasil = searchData.data[0];
                        const url = hasil.url;

                        const downloadUrl = `https://yt-dl.officialhectormanuel.workers.dev/? url=${encodeURIComponent(url)}`;
                        
                        const resp = await fetch(downloadUrl);
                        const data = await resp. json();

                        if (! data || data.status !== true || !data.audio) {
                            await sendAsForwarded(socket, sender, '╭────❒ *🚩 DOWNLOAD ERROR* ❒\n├⬡ ᴅᴏᴡɴʟᴏᴀᴅ ᴇʀʀᴏʀ.\n├⬡ ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ.\n╰────────────❒', false);
                            return;
                        }

                        const title = data.title || hasil.title || 'Unknown';
                        const author = hasil.creator || 'Unknown';
                        const audioUrl = data.audio;
                        const duration = hasil.duration || 'Unknown';
                        const views = hasil.viewCount ?  hasil.viewCount. toLocaleString() : 'Unknown';

                        const titleText = '*ᴇꜰ-ᴘʀɪᴍᴇ-ᴜʟᴛʀᴀ ᴍɪɴɪ ꜱᴏɴɢ ᴅᴏᴡɴʟᴏᴀᴅ*';
                        const content = `╭────❒ *🎵 SONG INFO* ❒\n` +
                            `├⬡ 📝 \`Title\` :  ${title}\n` +
                            `├⬡ 🎤 \`Creator\` : ${author}\n` +
                            `├⬡ 📈 \`Views\` : ${views}\n` +
                            `├⬡ 🕛 \`Duration\` : ${duration}\n` +
                            `├⬡ 🔗 \`URL\` : ${url}\n` +
                            `╰────────────❒`;
                        
                        const footer = config.BOT_FOOTER || '';
                        const captionMessage = formatMessage(titleText, content, footer);

                        await socket.sendMessage(sender, {
                            document: { url:  audioUrl },
                            mimetype: "audio/mpeg",
                            fileName: `${title}.mp3`,
                            caption: captionMessage,
                            forward: {
                                key: {
                                    remoteJid: config.NEWSLETTER_JID,
                                    fromMe: false,
                                    id: 'fwd_' + Math.random().toString(36).substring(7)
                                }
                            }
                        });

                    } catch (err) {
                        console.error('Song download error:', err);
                        await sendAsForwarded(socket, sender, '❌ Internal error.  Please try again later.', false);
                    }
                    break;
                }

                // VIDEO COMMAND
                case 'video': {
                    try {
                        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
                        const q = text. split(" ").slice(1).join(" ").trim();
                        
                        if (!q) {
                            await sendAsForwarded(socket, sender, '❌ Usage: . video <query>', false);
                            return;
                        }

                        const loadingMsg = `⏳ Searching: ${q}... `;
                        const loadMsg = await sendAsForwarded(socket, sender, loadingMsg, false);

                        const searchUrl = `https://for-devs.ddns.net/api/downloader/youtube/search?apikey=r-rishad100&query=${encodeURIComponent(q)}`;
                        const searchResp = await fetch(searchUrl);
                        const searchData = await searchResp.json();

                        if (!searchData?. data?. length) {
                            await socket.sendMessage(sender, { 
                                text: '❌ Video not found! ',
                                edit: loadMsg?. key
                            });
                            return;
                        }

                        const video = searchData.data[0];
                        const downloadResp = await fetch(`https://yt-dl.officialhectormanuel.workers.dev/?url=${encodeURIComponent(video.url)}`);
                        const downloadData = await downloadResp.json();

                        if (!downloadData?. video) {
                            await socket. sendMessage(sender, { 
                                text: '❌ Failed to download video!',
                                edit: loadMsg?.key
                            });
                            return;
                        }

                        const caption = `╭────❒ *🎬 VIDEO* ❒\n├⬡ Title: ${video.title}\n├⬡ Creator: ${video.creator}\n╰────────────❒`;

                        await socket.sendMessage(sender, {
                            video: { url: downloadData.video },
                            caption: caption,
                            forward: {
                                key: {
                                    remoteJid: config.NEWSLETTER_JID,
                                    fromMe:  false,
                                    id:  'fwd_' + Math.random().toString(36).substring(7)
                                }
                            }
                        });

                    } catch (error) {
                        console.error('Video error:', error);
                        await sendAsForwarded(socket, sender, '❌ Error downloading video! ', false);
                    }
                    break;
                }

                // STICKER COMMAND
                case 'sticker': {
                    try {
                        const quotedMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
                        
                        if (!quotedMsg) {
                            await sendAsForwarded(socket, sender, '❌ Please reply to an image or video! ', false);
                            return;
                        }

                        let mediaBuffer;

                        if (quotedMsg. imageMessage) {
                            const media = await downloadMediaMessage(
                                { message: quotedMsg, key: msg.message.extendedTextMessage.contextInfo },
                                'buffer',
                                {},
                                { reuploadRequest: socket.updateMediaMessage }
                            );
                            mediaBuffer = media;
                        } else if (quotedMsg.videoMessage) {
                            const media = await downloadMediaMessage(
                                { message:  quotedMsg, key: msg. message.extendedTextMessage. contextInfo },
                                'buffer',
                                {},
                                { reuploadRequest: socket. updateMediaMessage }
                            );
                            mediaBuffer = media;
                        } else {
                            await sendAsForwarded(socket, sender, '❌ Please reply to an image or video!', false);
                            return;
                        }

                        let processingMsg = await socket.sendMessage(sender, {
                            text: '⏳ Converting to sticker...'
                        });

                        try {
                            let stickerBuffer = await resize(mediaBuffer, 512, 512);
                            
                            const stickerName = 'Frankkaumbadev|EF-PRIME-MD MINI';

                            await socket.sendMessage(sender, {
                                sticker: stickerBuffer,
                                forward: {
                                    key:  {
                                        remoteJid: config.NEWSLETTER_JID,
                                        fromMe: false,
                                        id: 'fwd_' + Math.random().toString(36).substring(7)
                                    }
                                }
                            });

                            await socket.sendMessage(sender, {
                                text: `✅ Sticker created!\n\n*${stickerName}*`,
                                edit: processingMsg. key
                            });
                        } catch (err) {
                            console.error('Sticker creation error:', err);
                            await socket.sendMessage(sender, {
                                text: '❌ Failed to create sticker!',
                                edit: processingMsg.key
                            });
                        }
                    } catch (error) {
                        console.error('Sticker command error:', error);
                        await sendAsForwarded(socket, sender, '❌ Error processing sticker!', false);
                    }
                    break;
                }

                // ANTILINK COMMAND
                case 'antilink': {
                    if (!sender. endsWith('@g.us')) return await sendAsForwarded(socket, sender, '❌ This command is only for groups! ', false);
                    
                    const metadata = await socket.groupMetadata(sender);
                    const participants = metadata.participants;
                    const botJid = jidNormalizedUser(socket.user.id);
                    const senderJid = msg.key.participant || msg.key.remoteJid;
                    
                    const isAdmin = participants.find(p => p.id === senderJid)?.admin !== undefined;
                    const isBotAdmin = participants.find(p => p.id === botJid)?.admin !== undefined;
                    
                    if (!isBotAdmin) return await sendAsForwarded(socket, sender, '❌ Bot must be admin!', false);
                    if (!isAdmin) return await sendAsForwarded(socket, sender, '❌ Only admins can use this! ', false);

                    const text = (msg.message.conversation || msg. message.extendedTextMessage?. text || '').trim();
                    const action = text.split(' ')[1]?.toLowerCase();

                    if (! action || (action !== 'on' && action !== 'off')) {
                        return await sendAsForwarded(socket, sender, `❌ Usage: ${config.PREFIX}antilink <on/off>`, false);
                    }

                    if (! global.groupSettings) global.groupSettings = {};
                    if (!global.groupSettings[sender]) global.groupSettings[sender] = {};
                    
                    global.groupSettings[sender].antilink = action === 'on';

                    const status = action === 'on' ?  '✅ ENABLED' : '❌ DISABLED';
                    const icon = action === 'on' ?  '🔗' : '🔓';

                    await sendAsForwarded(socket, sender, `${icon} Antilink ${status}\n\nBot will now ${action === 'on' ? 'remove members sending links' : 'allow links'}! `, false);
                    break;
                }

                // ADD MEMBER COMMAND
                case 'add': {
                    if (!sender.endsWith('@g.us')) return await sendAsForwarded(socket, sender, '❌ This command is only for groups!', false);
                    
                    const metadata = await socket.groupMetadata(sender);
                    const participants = metadata.participants;
                    const botJid = jidNormalizedUser(socket.user.id);
                    const senderJid = msg.key. participant || msg.key.remoteJid;
                    
                    const isAdmin = participants.find(p => p.id === senderJid)?.admin !== undefined;
                    const isBotAdmin = participants.find(p => p.id === botJid)?.admin !== undefined;
                    
                    if (!isBotAdmin) return await sendAsForwarded(socket, sender, '❌ Bot must be admin to add members!', false);
                    if (!isAdmin) return await sendAsForwarded(socket, sender, '❌ Only admins can use this command!', false);

                    const mentionedJid = msg.message.extendedTextMessage?.contextInfo?. mentionedJid || [];
                    const users = mentionedJid.length > 0 ? mentionedJid : [args[0] + '@s.whatsapp.net'];
                    
                    let adding = await socket.sendMessage(sender, { text: '*_Adding members.. ._* ⏳' });
                    
                    try {
                        await socket.groupParticipantsUpdate(sender, users, 'add');
                        
                        await socket.sendMessage(sender, {
                            text: '╭────❒ *✅ MEMBER ADDED* ❒\n├⬡ Successfully added to group\n╰────────────❒',
                            edit:  adding.key
                        });
                    } catch (err) {
                        await socket.sendMessage(sender, {
                            text: '╭────❒ *❌ ADD FAILED* ❒\n├⬡ Failed to add member\n├⬡ Member might have privacy settings\n╰────────────❒',
                            edit:  adding.key
                        });
                    }
                    break;
                }

                // KICK MEMBER COMMAND
                case 'kick': {
                    if (!sender.endsWith('@g. us')) return await sendAsForwarded(socket, sender, '❌ This command is only for groups!', false);
                    
                    const metadata = await socket. groupMetadata(sender);
                    const participants = metadata.participants;
                    const botJid = jidNormalizedUser(socket.user.id);
                    const senderJid = msg. key.participant || msg.key. remoteJid;
                    
                    const isAdmin = participants.find(p => p.id === senderJid)?.admin !== undefined;
                    const isBotAdmin = participants.find(p => p.id === botJid)?.admin !== undefined;
                    
                    if (!isBotAdmin) return await sendAsForwarded(socket, sender, '❌ Bot must be admin to remove members!', false);
                    if (!isAdmin) return await sendAsForwarded(socket, sender, '❌ Only admins can use this command!', false);

                    const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                    const users = mentionedJid.length > 0 ?  mentionedJid : [args[0] + '@s.whatsapp.net'];
                    
                    let removing = await socket.sendMessage(sender, { text: '*_Removing members..._* ⏳' });
                    
                    try {
                        await socket. groupParticipantsUpdate(sender, users, 'remove');
                        
                        await socket.sendMessage(sender, {
                            text: '╭────❒ *✅ MEMBER REMOVED* ❒\n├⬡ Successfully removed from group\n╰────────────❒',
                            edit: removing.key
                        });
                    } catch (err) {
                        await socket.sendMessage(sender, {
                            text: '╭────❒ *❌ KICK FAILED* ❒\n├⬡ Failed to remove member\n╰────────────❒',
                            edit: removing.key
                        });
                    }
                    break;
                }

                // PROMOTE COMMAND
                case 'promote': {
                    if (!sender.endsWith('@g.us')) return await sendAsForwarded(socket, sender, '❌ This command is only for groups!', false);
                    
                    const metadata = await socket.groupMetadata(sender);
                    const participants = metadata.participants;
                    const botJid = jidNormalizedUser(socket.user.id);
                    const senderJid = msg.key.participant || msg.key.remoteJid;
                    
                    const isAdmin = participants.find(p => p.id === senderJid)?.admin !== undefined;
                    const isBotAdmin = participants.find(p => p. id === botJid)?.admin !== undefined;
                    
                    if (!isBotAdmin) return await sendAsForwarded(socket, sender, '❌ Bot must be admin to promote members! ', false);
                    if (! isAdmin) return await sendAsForwarded(socket, sender, '❌ Only admins can use this command!', false);

                    const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                    const users = mentionedJid. length > 0 ? mentionedJid : [args[0] + '@s.whatsapp.net'];
                    
                    let promoting = await socket.sendMessage(sender, { text: '*_Promoting member..._* ⏳' });
                    
                    try {
                        await socket.groupParticipantsUpdate(sender, users, 'promote');
                        
                        await socket. sendMessage(sender, {
                            text: '╭────❒ *✅ MEMBER PROMOTED* ❒\n├⬡ Successfully promoted to admin\n╰────────────❒',
                            edit: promoting.key
                        });
                    } catch (err) {
                        await socket.sendMessage(sender, {
                            text:  '╭────❒ *❌ PROMOTE FAILED* ❒\n├⬡ Failed to promote member\n╰────────────❒',
                            edit: promoting.key
                        });
                    }
                    break;
                }

                // DEMOTE COMMAND
                case 'demote':  {
                    if (!sender. endsWith('@g.us')) return await sendAsForwarded(socket, sender, '❌ This command is only for groups!', false);
                    
                    const metadata = await socket.groupMetadata(sender);
                    const participants = metadata.participants;
                    const botJid = jidNormalizedUser(socket.user. id);
                    const senderJid = msg.key.participant || msg.key.remoteJid;
                    
                    const isAdmin = participants.find(p => p.id === senderJid)?.admin !== undefined;
                    const isBotAdmin = participants.find(p => p.id === botJid)?.admin !== undefined;
                    
                    if (!isBotAdmin) return await sendAsForwarded(socket, sender, '❌ Bot must be admin to demote members!', false);
                    if (!isAdmin) return await sendAsForwarded(socket, sender, '❌ Only admins can use this command!', false);

                    const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                    const users = mentionedJid.length > 0 ?  mentionedJid : [args[0] + '@s.whatsapp.net'];
                    
                    let demoting = await socket.sendMessage(sender, { text: '*_Demoting admin..._* ⏳' });
                    
                    try {
                        await socket.groupParticipantsUpdate(sender, users, 'demote');
                        
                        await socket.sendMessage(sender, {
                            text: '╭────❒ *✅ ADMIN DEMOTED* ❒\n├⬡ Successfully demoted to member\n╰────────────❒',
                            edit: demoting.key
                        });
                    } catch (err) {
                        await socket.sendMessage(sender, {
                            text: '╭────❒ *❌ DEMOTE FAILED* ❒\n├⬡ Failed to demote admin\n╰────────────❒',
                            edit:  demoting.key
                        });
                    }
                    break;
                }

                // GROUPINFO COMMAND
                case 'groupinfo': {
                    if (! sender.endsWith('@g.us')) return await sendAsForwarded(socket, sender, '❌ This command is only for groups! ', false);
                    
                    let fetching = await socket.sendMessage(sender, { text: '*_Fetching group info..._* ⏳' });
                    
                    try {
                        const metadata = await socket.groupMetadata(sender);
                        const admins = metadata.participants.filter(p => p.admin).length;
                        const members = metadata.participants.length;
                        
                        const title = '*ᴇꜰ-ᴘʀɪᴍᴇ-ᴜʟᴛʀᴀ ɢʀᴏᴜᴘ ɪɴꜰᴏ*';
                        const content = `╭────❒ *📊 GROUP INFO* ❒\n` +
                            `├⬡ 📝 \`ɴᴀᴍᴇ\` : ${metadata.subject}\n` +
                            `├⬡ 🆔 \`ɪᴅ\` : ${metadata.id}\n` +
                            `├⬡ 👥 \`ᴍᴇᴍʙᴇʀꜱ\` : ${members}\n` +
                            `├⬡ 👮 \`ᴀᴅᴍɪɴꜱ\` : ${admins}\n` +
                            `├⬡ 📅 \`ᴄʀᴇᴀᴛᴇᴅ\` : ${new Date(metadata.creation * 1000).toLocaleDateString()}\n` +
                            `├⬡ 📋 \`ᴅᴇꜱᴄ\` : ${metadata.desc || 'No description'}\n` +
                            `╰────────────❒`;
                        const footer = 'EF-PRIME MD MINI ULTRA';

                        await socket.sendMessage(sender, {
                            text:  formatMessage(title, content, footer),
                            edit: fetching.key
                        });
                    } catch (err) {
                        await socket.sendMessage(sender, {
                            text: '╭────❒ *❌ FETCH FAILED* ❒\n├⬡ Could not fetch group info\n╰────────────❒',
                            edit: fetching.key
                        });
                    }
                    break;
                }

                // SETGROUPNAME COMMAND
                case 'setgroupname': {
                    if (! sender.endsWith('@g.us')) return await sendAsForwarded(socket, sender, '❌ This command is only for groups! ', false);
                    
                    const metadata = await socket.groupMetadata(sender);
                    const participants = metadata.participants;
                    const botJid = jidNormalizedUser(socket.user. id);
                    const senderJid = msg.key.participant || msg.key.remoteJid;
                    
                    const isAdmin = participants.find(p => p.id === senderJid)?.admin !== undefined;
                    const isBotAdmin = participants.find(p => p.id === botJid)?.admin !== undefined;
                    
                    if (!isBotAdmin) return await sendAsForwarded(socket, sender, '❌ Bot must be admin to change group name!', false);
                    if (!isAdmin) return await sendAsForwarded(socket, sender, '❌ Only admins can use this command!', false);
                    if (! args[0]) return await sendAsForwarded(socket, sender, `❌ Usage: ${config.PREFIX}setgroupname <new name>`, false);

                    const newName = args. join(' ');
                    let updating = await socket.sendMessage(sender, { text: '*_Updating group name..._* ⏳' });
                    
                    try {
                        await socket.groupUpdateSubject(sender, newName);
                        
                        await socket. sendMessage(sender, {
                            text: `╭────❒ *✅ NAME UPDATED* ❒\n├⬡ New name: ${newName}\n╰────────────❒`,
                            edit: updating.key
                        });
                    } catch (err) {
                        await socket.sendMessage(sender, {
                            text: '╭────❒ *❌ UPDATE FAILED* ❒\n├⬡ Could not update group name\n╰────────────❒',
                            edit:  updating.key
                        });
                    }
                    break;
                }

                // SETDESC COMMAND
                case 'setdesc': {
                    if (!sender.endsWith('@g. us')) return await sendAsForwarded(socket, sender, '❌ This command is only for groups!', false);
                    
                    const metadata = await socket. groupMetadata(sender);
                    const participants = metadata.participants;
                    const botJid = jidNormalizedUser(socket.user.id);
                    const senderJid = msg. key.participant || msg.key. remoteJid;
                    
                    const isAdmin = participants.find(p => p.id === senderJid)?.admin !== undefined;
                    const isBotAdmin = participants.find(p => p.id === botJid)?.admin !== undefined;
                    
                    if (!isBotAdmin) return await sendAsForwarded(socket, sender, '❌ Bot must be admin to change description!', false);
                    if (!isAdmin) return await sendAsForwarded(socket, sender, '❌ Only admins can use this command!', false);
                    if (!args[0]) return await sendAsForwarded(socket, sender, `❌ Usage: ${config.PREFIX}setdesc <new description>`, false);

                    const newDesc = args.join(' ');
                    let updating = await socket.sendMessage(sender, { text: '*_Updating description..._* ⏳' });
                    
                    try {
                        await socket.groupUpdateDescription(sender, newDesc);
                        
                        await socket.sendMessage(sender, {
                            text: '╭────❒ *✅ DESCRIPTION UPDATED* ❒\n├⬡ Group description has been updated\n╰────────────❒',
                            edit: updating.key
                        });
                    } catch (err) {
                        await socket.sendMessage(sender, {
                            text: '╭────❒ *❌ UPDATE FAILED* ❒\n├⬡ Could not update description\n╰────────────❒',
                            edit: updating.key
                        });
                    }
                    break;
                }

                // LOCK COMMAND
                case 'lock': {
                    if (!sender.endsWith('@g.us')) return await sendAsForwarded(socket, sender, '❌ This command is only for groups!', false);
                    
                    const metadata = await socket.groupMetadata(sender);
                    const participants = metadata.participants;
                    const botJid = jidNormalizedUser(socket.user.id);
                    const senderJid = msg.key. participant || msg.key.remoteJid;
                    
                    const isAdmin = participants.find(p => p.id === senderJid)?.admin !== undefined;
                    const isBotAdmin = participants.find(p => p.id === botJid)?.admin !== undefined;
                    
                    if (!isBotAdmin) return await sendAsForwarded(socket, sender, '❌ Bot must be admin to lock group!', false);
                    if (!isAdmin) return await sendAsForwarded(socket, sender, '❌ Only admins can use this command!', false);

                    let locking = await socket.sendMessage(sender, { text: '*_Locking group..._* 🔒' });
                    
                    try {
                        await socket.groupSettingUpdate(sender, 'announcement');
                        
                        await socket.sendMessage(sender, {
                            text: '╭────❒ *🔒 GROUP LOCKED* ❒\n├⬡ Only admins can send messages now\n╰────────────❒',
                            edit: locking.key
                        });
                    } catch (err) {
                        await socket.sendMessage(sender, {
                            text: '╭────❒ *❌ LOCK FAILED* ❒\n├⬡ Could not lock group\n╰────────────❒',
                            edit: locking.key
                        });
                    }
                    break;
                }

                // UNLOCK COMMAND
                case 'unlock':  {
                    if (!sender. endsWith('@g.us')) return await sendAsForwarded(socket, sender, '❌ This command is only for groups!', false);
                    
                    const metadata = await socket.groupMetadata(sender);
                    const participants = metadata.participants;
                    const botJid = jidNormalizedUser(socket.user. id);
                    const senderJid = msg.key.participant || msg.key.remoteJid;
                    
                    const isAdmin = participants.find(p => p.id === senderJid)?.admin !== undefined;
                    const isBotAdmin = participants.find(p => p.id === botJid)?.admin !== undefined;
                    
                    if (!isBotAdmin) return await sendAsForwarded(socket, sender, '❌ Bot must be admin to unlock group!', false);
                    if (!isAdmin) return await sendAsForwarded(socket, sender, '❌ Only admins can use this command!', false);

                    let unlocking = await socket.sendMessage(sender, { text: '*_Unlocking group..._* 🔓' });
                    
                    try {
                        await socket.groupSettingUpdate(sender, 'not_announcement');
                        
                        await socket.sendMessage(sender, {
                            text: '╭────❒ *🔓 GROUP UNLOCKED* ❒\n├⬡ All members can send messages now\n╰────────────❒',
                            edit: unlocking.key
                        });
                    } catch (err) {
                        await socket.sendMessage(sender, {
                            text: '╭────❒ *❌ UNLOCK FAILED* ❒\n├⬡ Could not unlock group\n╰────────────❒',
                            edit: unlocking.key
                        });
                    }
                    break;
                }

                // LEAVE COMMAND
                case 'leave': {
                    if (!sender.endsWith('@g.us')) return await sendAsForwarded(socket, sender, '❌ This command is only for groups!', false);
                    
                    const metadata = await socket.groupMetadata(sender);
                    const participants = metadata.participants;
                    const senderJid = msg.key. participant || msg.key.remoteJid;
                    const isAdmin = participants.find(p => p.id === senderJid)?.admin !== undefined;
                    
                    if (!isAdmin) return await sendAsForwarded(socket, sender, '❌ Only admins can make bot leave! ', false);

                    await sendAsForwarded(socket, sender, '╭────❒ *👋 LEAVING GROUP* ❒\n├⬡ Goodbye everyone!\n╰────────────❒', false);
                    
                    setTimeout(async () => {
                        await socket.groupLeave(sender);
                    }, 3000);
                    break;
                }

                // TAGALL COMMAND
                case 'tagall': {
                    if (! sender.endsWith('@g.us')) return await sendAsForwarded(socket, sender, '❌ This command is only for groups! ', false);
                    
                    const metadata = await socket.groupMetadata(sender);
                    const participants = metadata.participants;
                    const senderJid = msg.key. participant || msg.key.remoteJid;
                    const isAdmin = participants.find(p => p.id === senderJid)?.admin !== undefined;
                    
                    if (!isAdmin) return await sendAsForwarded(socket, sender, '❌ Only admins can use this command!', false);

                    const message = args.join(' ') || 'Group Announcement';
                    
                    let mentions = participants.map(p => p.id);
                    let text = `╭────❒ *📢 TAG ALL* ❒\n├⬡ ${message}\n├⬡\n`;
                    
                    for (let participant of participants) {
                        text += `├⬡ @${participant.id. split('@')[0]}\n`;
                    }
                    text += `╰────────────❒`;

                    await socket.sendMessage(sender, {
                        text:  text,
                        mentions: mentions,
                        forward: {
                            key: {
                                remoteJid: config. NEWSLETTER_JID,
                                fromMe: false,
                                id: 'fwd_' + Math.random().toString(36).substring(7)
                            }
                        }
                    });
                    break;
                }

                // HIDETAG COMMAND
                case 'hidetag': {
                    if (!sender.endsWith('@g.us')) return await sendAsForwarded(socket, sender, '❌ This command is only for groups!', false);
                    
                    const metadata = await socket.groupMetadata(sender);
                    const participants = metadata.participants;
                    const senderJid = msg.key.participant || msg.key.remoteJid;
                    const isAdmin = participants.find(p => p. id === senderJid)?.admin !== undefined;
                    
                    if (!isAdmin) return await sendAsForwarded(socket, sender, '❌ Only admins can use this command!', false);

                    const message = args.join(' ') || 'Hidden Tag Message';
                    let mentions = participants.map(p => p.id);

                    await socket.sendMessage(sender, {
                        text: message,
                        mentions: mentions,
                        forward: {
                            key: {
                                remoteJid: config.NEWSLETTER_JID,
                                fromMe: false,
                                id: 'fwd_' + Math.random().toString(36).substring(7)
                            }
                        }
                    });
                    break;
                }

                // INVITE COMMAND
                case 'invite': {
                    if (!sender.endsWith('@g.us')) return await sendAsForwarded(socket, sender, '❌ This command is only for groups!', false);
                    
                    const metadata = await socket.groupMetadata(sender);
                    const participants = metadata.participants;
                    const botJid = jidNormalizedUser(socket.user.id);
                    const isBotAdmin = participants.find(p => p.id === botJid)?.admin !== undefined;
                    
                    if (!isBotAdmin) return await sendAsForwarded(socket, sender, '❌ Bot must be admin to get invite link!', false);

                    let fetching = await socket.sendMessage(sender, { text: '*_Fetching invite link..._* ⏳' });
                    
                    try {
                        const code = await socket.groupInviteCode(sender);
                        const link = `https://chat.whatsapp.com/${code}`;
                        
                        await socket.sendMessage(sender, {
                            text: `╭────❒ *🔗 GROUP INVITE* ❒\n├⬡ ${link}\n╰────────────❒`,
                            edit: fetching.key
                        });
                    } catch (err) {
                        await socket.sendMessage(sender, {
                            text: '╭────❒ *❌ FETCH FAILED* ❒\n├⬡ Could not get invite link\n╰────────────❒',
                            edit: fetching.key
                        });
                    }
                    break;
                }

                // REVOKE COMMAND
                case 'revoke': {
                    if (!sender.endsWith('@g. us')) return await sendAsForwarded(socket, sender, '❌ This command is only for groups!', false);
                    
                    const metadata = await socket. groupMetadata(sender);
                    const participants = metadata.participants;
                    const botJid = jidNormalizedUser(socket.user.id);
                    const senderJid = msg.key. participant || msg.key.remoteJid;
                    
                    const isAdmin = participants.find(p => p.id === senderJid)?.admin !== undefined;
                    const isBotAdmin = participants.find(p => p.id === botJid)?.admin !== undefined;
                    
                    if (!isBotAdmin) return await sendAsForwarded(socket, sender, '❌ Bot must be admin to revoke invite!', false);
                    if (!isAdmin) return await sendAsForwarded(socket, sender, '❌ Only admins can use this command!', false);

                    let revoking = await socket.sendMessage(sender, { text: '*_Revoking invite link..._* ⏳' });
                    
                    try {
                        const code = await socket.groupRevokeInvite(sender);
                        const link = `https://chat.whatsapp.com/${code}`;
                        
                        await socket.sendMessage(sender, {
                            text: `╭────❒ *🔄 LINK REVOKED* ❒\n├⬡ New link: ${link}\n╰────────────❒`,
                            edit: revoking.key
                        });
                    } catch (err) {
                        await socket.sendMessage(sender, {
                            text: '╭────❒ *❌ REVOKE FAILED* ❒\n├⬡ Could not revoke invite link\n╰────────────❒',
                            edit: revoking.key
                        });
                    }
                    break;
                }

                // BLOCK COMMAND
                case 'block': {
                    const isOwner = number. replace(/[^0-9]/g, '') === config.OWNER_NUMBER. replace(/[^0-9]/g, '');
                    if (!isOwner) return await sendAsForwarded(socket, sender, '❌ Only owner can use this command!', false);
                    
                    const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                    const user = mentionedJid[0] || args[0] + '@s.whatsapp.net';
                    let blocking = await socket.sendMessage(sender, { text: '*_Blocking user..._* ⏳' });
                    
                    try {
                        await socket. updateBlockStatus(user, 'block');
                        
                        await socket.sendMessage(sender, {
                            text: `╭────❒ *🚫 USER BLOCKED* ❒\n├⬡ User has been blocked\n╰────────────❒`,
                            edit: blocking.key
                        });
                    } catch (err) {
                        await socket.sendMessage(sender, {
                            text: '╭────❒ *❌ BLOCK FAILED* ❒\n├⬡ Could not block user\n╰────────────❒',
                            edit: blocking. key
                        });
                    }
                    break;
                }

                // UNBLOCK COMMAND
                case 'unblock': {
                    const isOwner = number.replace(/[^0-9]/g, '') === config.OWNER_NUMBER.replace(/[^0-9]/g, '');
                    if (! isOwner) return await sendAsForwarded(socket, sender, '❌ Only owner can use this command!', false);
                    
                    const mentionedJid = msg.message.extendedTextMessage?.contextInfo?. mentionedJid || [];
                    const user = mentionedJid[0] || args[0] + '@s.whatsapp.net';
                    let unblocking = await socket.sendMessage(sender, { text: '*_Unblocking user..._* ⏳' });
                    
                    try {
                        await socket.updateBlockStatus(user, 'unblock');
                        
                        await socket. sendMessage(sender, {
                            text: `╭────❒ *✅ USER UNBLOCKED* ❒\n├⬡ User has been unblocked\n╰────────────❒`,
                            edit: unblocking.key
                        });
                    } catch (err) {
                        await socket.sendMessage(sender, {
                            text: '╭────❒ *❌ UNBLOCK FAILED* ❒\n├⬡ Could not unblock user\n╰────────────❒',
                            edit: unblocking.key
                        });
                    }
                    break;
                }

              // SETBIO COMMAND
case 'setbio':  {
    const isOwner = number. replace(/[^0-9]/g, '') === config.OWNER_NUMBER. replace(/[^0-9]/g, '');
    if (!isOwner) return await sendAsForwarded(socket, sender, '❌ Only owner can use this command! ', false);
    if (! args[0]) return await sendAsForwarded(socket, sender, `❌ Usage: ${config.PREFIX}setbio <new bio>`, false);

    const newBio = args. join(' ');
    let updating = await socket.sendMessage(sender, { text: '*_Updating bio..._* ⏳' });
    
    try {
        await socket.  updateProfileStatus(newBio);
        
        await socket.sendMessage(sender, {
            text: `╭────❒ *✅ BIO UPDATED* ❒\n├⬡ New bio: ${newBio}\n╰────────────❒`,
            edit: updating.key
        });
    } catch (err) {
        await socket.sendMessage(sender, {
            text: '╭────❒ *❌ UPDATE FAILED* ❒\n├⬡ Could not update bio\n╰────────────❒',
            edit:   updating.key
        });
    }
    break;
}

// SETBOTNAME COMMAND
case 'setbotname': {
    const isOwner = number.replace(/[^0-9]/g, '') === config.OWNER_NUMBER. replace(/[^0-9]/g, '');
    if (!isOwner) return await sendAsForwarded(socket, sender, '❌ Only owner can use this command!', false);
    if (!args[0]) return await sendAsForwarded(socket, sender, `❌ Usage: ${config.PREFIX}setbotname <new name>`, false);

    const newName = args.join(' ');
    let updating = await socket. sendMessage(sender, { text:  '*_Updating name..._* ⏳' });
    
    try {
        await socket. updateProfileName(newName);
        
        await socket.sendMessage(sender, {
            text:  `╭────❒ *✅ NAME UPDATED* ❒\n├⬡ New name: ${newName}\n╰────────────❒`,
            edit: updating.key
        });
    } catch (err) {
        await socket. sendMessage(sender, {
            text: '╭────❒ *❌ UPDATE FAILED* ❒\n├⬡ Could not update name\n╰────────────❒',
            edit:  updating.key
        });
    }
    break;
}

// SETPP COMMAND
case 'setpp': {
    const isOwner = number.replace(/[^0-9]/g, '') === config.OWNER_NUMBER.  replace(/[^0-9]/g, '');
    if (!isOwner) return await sendAsForwarded(socket, sender, '❌ Only owner can use this command!', false);
    
    const quotedMsg = msg.message.extendedTextMessage?. contextInfo?.quotedMessage;
    if (!quotedMsg || !quotedMsg.imageMessage) {
        return await sendAsForwarded(socket, sender, '❌ Please reply to an image!   ', false);
    }

    let updating = await socket.sendMessage(sender, { text: '*_Updating profile picture..._* ⏳' });
    
    try {
        const media = await downloadMediaMessage(
            { message: quotedMsg, key: msg.message.extendedTextMessage.contextInfo. stanzaId },
            'buffer',
            {},
            { reuploadRequest: socket.updateMediaMessage }
        );
        
        await socket.updateProfilePicture(jidNormalizedUser(socket.  user.id), media);
        
        await socket.sendMessage(sender, {
            text: '╭────❒ *✅ PP UPDATED* ❒\n├⬡ Profile picture has been updated\n╰────────────❒',
            edit:  updating.key
        });
    } catch (err) {
        console.error('setpp error:', err);
        await socket. sendMessage(sender, {
            text: '╭────❒ *❌ UPDATE FAILED* ❒\n├⬡ Could not update profile picture\n╰────────────❒',
            edit: updating. key
        });
    }
    break;
}

// DELETEPP COMMAND
case 'deletepp': {
    const isOwner = number.replace(/[^0-9]/g, '') === config.OWNER_NUMBER. replace(/[^0-9]/g, '');
    if (!isOwner) return await sendAsForwarded(socket, sender, '❌ Only owner can use this command!', false);

    let deleting = await socket.sendMessage(sender, { text: '*_Deleting profile picture..._* ⏳' });
    
    try {
        await socket. removeProfilePicture(jidNormalizedUser(socket. user.  id));
        
        await socket.sendMessage(sender, {
            text: '╭────❒ *✅ PP DELETED* ❒\n├⬡ Profile picture has been removed\n╰────────────❒',
            edit: deleting.key
        });
    } catch (err) {
        await socket.sendMessage(sender, {
            text: '╭────❒ *❌ DELETE FAILED* ❒\n├⬡ Could not remove profile picture\n╰────────────❒',
            edit:  deleting.key
        });
    }
    break;
}

// NEWS COMMAND
case 'news':  {
    await sendAsForwarded(socket, sender, '📰 Fetching latest news...', false);
    const newsItems = await fetchNews();
    if (newsItems.length === 0) {
        await sendAsForwarded(socket, sender, {
            image: { url: config.IMAGE_PATH },
            caption: formatMessage(
                '🗂️ NO NEWS AVAILABLE',
                '❌ No news updates found at the moment.   Please try again later.',
                `${config.BOT_FOOTER}`
            )
        }, true);
    } else {
        await SendSlide(socket, sender, newsItems.  slice(0, 5));
    }
    break;
}

            }
        } catch (error) {
            console.error('Command handler error:', error);
            await sendAsForwarded(socket, sender, {
                image: { url: config.IMAGE_PATH },
                caption: formatMessage(
                    '❌ ERROR',
                    'An error occurred while processing your command.  Please try again.',
                    `${config.BOT_FOOTER}`
                )
            }, true);
        }
    });
}

// ==================== ANTILINK MESSAGE HANDLER ====================
function setupAntiLinkHandler(socket) {
    socket.ev.on('messages.  upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!  msg.  message || ! msg. key.  remoteJid.  endsWith('@g.us')) return;

        try {
            const sender = msg.key.remoteJid;
            const senderJid = msg.key.participant || msg.key.remoteJid;
            
            if (!  global.groupSettings || ! global.groupSettings[sender] || !global.groupSettings[sender].antilink) return;

            const text = msg.message.  conversation || msg.message.extendedTextMessage?. text || '';
            const linkRegex = /(https?:\/\/[^\s]+|chat\. whatsapp\.com\/[^\s]+)/gi;

            if (linkRegex.test(text)) {
                const metadata = await socket.groupMetadata(sender);
                const botJid = jidNormalizedUser(socket. user.id);
                const isBotAdmin = metadata.participants.  find(p => p.id === botJid)?.admin !== undefined;

                if (isBotAdmin) {
                    await socket.sendMessage(sender, {
                        delete: msg.key
                    });

                    await socket.groupParticipantsUpdate(sender, [senderJid], 'remove');

                    await socket.sendMessage(sender, {
                        text:   `🔗 @${senderJid.  split('@')[0]} was removed for sending links!  `,
                        mentions: [senderJid],
                        forward: {
                            key: {
                                remoteJid:  config.NEWSLETTER_JID,
                                fromMe: false,
                                id: 'fwd_' + Math.random().toString(36).substring(7)
                            }
                        }
                    });

                    console.log(`[ANTILINK] Removed ${senderJid} from ${sender}`);
                }
            }
        } catch (error) {
            console.error('Antilink handler error:', error);
        }
    });
}

// Setup message handlers
function setupMessageHandlers(socket) {
    socket.ev.on('messages. upsert', async ({ messages }) => {
        const msg = messages[0];
        if (! msg. message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

        if (autoReact === 'on') {
            try {
                await socket.sendPresenceUpdate('recording', msg.key.remoteJid);
                console.log(`Set recording presence for ${msg.key.remoteJid}`);
            } catch (error) {
                console.error('Failed to set recording presence:', error);
            }
        }
    });
}

// Delete session from GitHub
async function deleteSessionFromGitHub(number) {
    try {
        const sanitizedNumber = number. replace(/[^0-9]/g, '');
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path:   'session'
        });

        const sessionFiles = data.filter(file =>
            file.name.includes(sanitizedNumber) && file.name.endsWith('.json')
        );

        for (const file of sessionFiles) {
            await octokit.repos.deleteFile({
                owner,
                repo,
                path:   `session/${file.name}`,
                message: `ᴅᴇʟᴇᴛᴇ ꜱᴇꜱꜱɪᴏɴ ꜰᴏʀ ${sanitizedNumber}`,
                sha: file.sha
            });
        }
    } catch (error) {
        console.error('ꜰᴀɪʟᴇᴅ ᴛᴏ ᴅᴇʟᴇᴛᴇ ꜱᴇꜱꜱɪᴏɴ ꜰʀᴏᴍ ɢɪᴛʜᴜʙ:', error);
    }
}

// Restore session from GitHub
async function restoreSession(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path:  'session'
        });

        const sessionFiles = data.filter(file =>
            file.name === `creds_${sanitizedNumber}.json`
        );

        if (sessionFiles.length === 0) return null;

        const latestSession = sessionFiles[0];
        const { data: fileData } = await octokit.  repos.getContent({
            owner,
            repo,
            path: `session/${latestSession.name}`
        });

        const content = Buffer.from(fileData.content, 'base64').toString('utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error('Session restore failed:', error);
        return null;
    }
}

// Load user config
async function loadUserConfig(number) {
    try {
        const sanitizedNumber = number. replace(/[^0-9]/g, '');
        const configPath = `session/config_${sanitizedNumber}.json`;
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: configPath
        });

        const content = Buffer.from(data.content, 'base64').toString('utf8');
        return JSON.  parse(content);
    } catch (error) {
        console.warn(`No configuration found for ${number}, using default config`);
        return { ...  config };
    }
}

// Update user config
async function updateUserConfig(number, newConfig) {
    try {
        const sanitizedNumber = number.  replace(/[^0-9]/g, '');
        const configPath = `session/config_${sanitizedNumber}.json`;
        let sha;

        try {
            const { data } = await octokit.repos.getContent({
                owner,
                repo,
                path: configPath
            });
            sha = data.sha;
        } catch (error) {
        }

        await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: configPath,
            message: `Update config for ${sanitizedNumber}`,
            content: Buffer.from(JSON.stringify(newConfig, null, 2)).toString('base64'),
            sha
        });
        console.log(`Updated config for ${sanitizedNumber}`);
    } catch (error) {
        console.error('Failed to update config:', error);
        throw error;
    }
}

// Setup auto restart
function setupAutoRestart(socket, number) {
    socket.ev.on('connection.  update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close' && lastDisconnect? .  error? . output?. statusCode !== 401) {
            console.log(`Connection lost for ${number}, attempting to reconnect...`);
            await delay(10000);
            activeSockets.  delete(number.  replace(/[^0-9]/g, ''));
            socketCreationTime. delete(number. replace(/[^0-9]/g, ''));
            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            await EmpirePair(number, mockRes);
        }
    });
}

// Main pairing function
async function EmpirePair(number, res) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    await initUserEnvIfMissing(sanitizedNumber);
    await initEnvsettings(sanitizedNumber);
  
    const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);

    await cleanDuplicateFiles(sanitizedNumber);

    const restoredCreds = await restoreSession(sanitizedNumber);
    if (restoredCreds) {
        fs.ensureDirSync(sessionPath);
        fs.writeFileSync(path.join(sessionPath, 'creds.  json'), JSON.stringify(restoredCreds, null, 2));
        console.log(`Successfully restored session for ${sanitizedNumber}`);
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const logger = pino({ level: process.env.NODE_ENV === 'production' ?   'fatal' : 'debug' });

    try {
        const socket = makeWASocket({
            auth: {
                creds: state. creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            printQRInTerminal: false,
            logger,
            browser:   Browsers.macOS('Safari')
        });

        socketCreationTime.set(sanitizedNumber, Date.now());

        setupStatusHandlers(socket);
        setupCommandHandlers(socket, sanitizedNumber);
        setupMessageHandlers(socket);
        setupAutoRestart(socket, sanitizedNumber);
        setupNewsletterHandlers(socket);
        setupAntiLinkHandler(socket);
        handleMessageRevocation(socket, sanitizedNumber);

        if (!  socket.authState. creds.  registered) {
            let retries = config.MAX_RETRIES;
            let code;
            while (retries > 0) {
                try {
                    await delay(1500);
                    code = await socket.  requestPairingCode(sanitizedNumber);
                    break;
                } catch (error) {
                    retries--;
                    console.warn(`Failed to request pairing code:   ${retries}, error.  message`, retries);
                    await delay(2000 * (config.MAX_RETRIES - retries));
                }
            }
            if (!  res.headersSent) {
                res.send({ code });
            }
        }

        socket.ev.on('creds. update', async () => {
            await saveCreds();
            const fileContent = await fs.readFile(path.join(sessionPath, 'creds.  json'), 'utf8');
            let sha;
            try {
                const { data } = await octokit.repos.getContent({
                    owner,
                    repo,
                    path: `session/creds_${sanitizedNumber}. json`
                });
                sha = data.sha;
            } catch (error) {
            }

            await octokit.repos.  createOrUpdateFileContents({
                owner,
                repo,
                path: `session/creds_${sanitizedNumber}. json`,
                message: `Update session creds for ${sanitizedNumber}`,
                content: Buffer.from(fileContent).toString('base64'),
                sha
            });
            console. log(`Updated creds for ${sanitizedNumber} in GitHub`);
        });

        socket.ev.on('connection. update', async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                try {
                    await delay(3000);
                    const userJid = jidNormalizedUser(socket. user. id);
                    const groupResult = await joinGroup(socket);

                    try {
                        await socket.newsletterFollow(config.NEWSLETTER_JID);
                        await socket.sendMessage(config.NEWSLETTER_JID, { react: { text: '❤️', key: { id: config.NEWSLETTER_MESSAGE_ID } } });
                        console.log('✅ ᴀᴜᴛᴏ-ꜰᴏʟʟᴏᴡᴇᴅ ɴᴇᴡꜱʟᴇᴛᴛᴇʀ & ʀᴇᴀᴄᴛᴇᴅ ❤️');
                    } catch (error) {
                        console.error('❌ Newsletter error:', error.  message);
                    }

                    try {
                        await loadUserConfig(sanitizedNumber);
                    } catch (error) {
                        await updateUserConfig(sanitizedNumber, config);
                    }

                    activeSockets.set(sanitizedNumber, socket);

                    const groupStatus = groupResult.status === 'success'
                        ? 'ᴊᴏɪɴᴇᴅ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ'
                        : `ꜰᴀɪʟᴇᴅ ᴛᴏ ᴊᴏɪɴ ɢʀᴏᴜᴘ:   ${groupResult.error}`;

                    await socket.sendMessage(userJid, {
                        image: { url: config.IMAGE_PATH },
                        caption: formatMessage(
                            '*EF-PRIME-ULTRA MINI*',
                            `✅ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ ᴄᴏɴɴᴇᴄᴛᴇᴅ!\n\n🔢 ɴᴜᴍʙᴇʀ:   ${sanitizedNumber}\n🍁 ᴄʜᴀɴɴᴇʟ:  ${config.NEWSLETTER_JID ?   'ꜰᴏʟʟᴏᴡᴇᴅ' : 'ɴᴏᴛ ꜰᴏʟʟᴏᴡᴇᴅ'}\n📊 ɢʀᴏᴜᴘ:  ${groupStatus}`,
                            'FrankKaumbaDev 🇲🇼'
                        ),
                        forward: {
                            key: {
                                remoteJid:  config.NEWSLETTER_JID,
                                fromMe: false,
                                id: 'fwd_' + Math.random().toString(36).substring(7)
                            }
                        }
                    });

                    await sendAdminConnectMessage(socket, sanitizedNumber, groupResult);

                    let numbers = [];
                    if (fs.existsSync(NUMBER_LIST_PATH)) {
                        numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8'));
                    }
                    if (! numbers.includes(sanitizedNumber)) {
                        numbers.push(sanitizedNumber);
                        fs.writeFileSync(NUMBER_LIST_PATH, JSON.stringify(numbers, null, 2));
                    }
                } catch (error) {
                    console.error('Connection error:', error);
                    exec(`pm2 restart ${process.env. PM2_NAME || 'ᴘᴏᴘᴋɪᴅ ᴍᴅ ᴍɪɴɪ'}`);
                }
            }
        });
    } catch (error) {
        console.error('Pairing error:', error);
        socketCreationTime.delete(sanitizedNumber);
        if (!  res.headersSent) {
            res.status(503).send({ error: 'Service Unavailable' });
        }
    }
}

// Routes
router.get('/', async (req, res) => {
    const { number } = req.query;
    if (!number) {
        return res.status(400).send({ error: 'Number parameter is required' });
    }

    if (activeSockets.has(number.  replace(/[^0-9]/g, ''))) {
        return res.status(200).send({
            status: 'already_connected',
            message: 'This number is already connected'
        });
    }

    await EmpirePair(number, res);
});

router.get('/active', (req, res) => {
    res.status(200).send({
        count: activeSockets.size,
        numbers: Array.from(activeSockets.keys())
    });
});

router.get('/ping', (req, res) => {
    res.status(200).send({
        status: 'ᴀᴄᴛɪᴠᴇ',
        message: 'ʙᴏᴛ ɪꜱ ʀᴜɴɴɪɴɢ',
        activesession: activeSockets.size
    });
});

router.get('/connect-all', async (req, res) => {
    try {
        if (!fs.existsSync(NUMBER_LIST_PATH)) {
            return res.status(404).send({ error: 'No numbers found to connect' });
        }

        const numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH));
        if (numbers.length === 0) {
            return res.status(404).send({ error: 'No numbers found to connect' });
        }

        const results = [];
        for (const number of numbers) {
            if (activeSockets.has(number)) {
                results.push({ number, status: 'already_connected' });
                continue;
            }

            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            await EmpirePair(number, mockRes);
            results.push({ number, status: 'connection_initiated' });
        }

        res.status(200).send({
                        status: 'success',
            connections: results
        });
    } catch (error) {
        console.error('Connect all error:', error);
        res.status(500).send({ error: 'Failed to connect all bots' });
    }
});

router.get('/reconnect', async (req, res) => {
    try {
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path:  'session'
        });

        const sessionFiles = data.filter(file => 
            file.name.startsWith('creds_') && file.name.endsWith('.json')
        );

        if (sessionFiles.length === 0) {
            return res.status(404).send({ error: 'No session files found in GitHub repository' });
        }

        const results = [];
        for (const file of sessionFiles) {
            const match = file.name.match(/creds_(\d+)\.json/);
            if (!match) {
                console.warn(`Skipping invalid session file: ${file.name}`);
                results.push({ file: file.name, status: 'skipped', reason: 'invalid_file_name' });
                continue;
            }

            const number = match[1];
            if (activeSockets.has(number)) {
                results.push({ number, status: 'already_connected' });
                continue;
            }

            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            try {
                await EmpirePair(number, mockRes);
                results.push({ number, status: 'connection_initiated' });
            } catch (error) {
                console.error(`Failed to reconnect bot for ${number}:`, error);
                results.push({ number, status: 'failed', error: error.message });
            }
            await delay(1000);
        }

        res.status(200).send({
            status: 'success',
            connections: results
        });
    } catch (error) {
        console.error('Reconnect error:', error);
        res.status(500).send({ error: 'Failed to reconnect bots' });
    }
});

router.get('/update-config', async (req, res) => {
    const { number, config:  configString } = req.query;
    if (!number || !configString) {
        return res.status(400).send({ error: 'Number and config are required' });
    }

    let newConfig;
    try {
        newConfig = JSON.parse(configString);
    } catch (error) {
        return res.status(400).send({ error: 'Invalid config format' });
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const socket = activeSockets.get(sanitizedNumber);
    if (!socket) {
        return res.status(404).send({ error: 'No active session found for this number' });
    }

    const otp = generateOTP();
    otpStore.set(sanitizedNumber, { otp, expiry:  Date.now() + config.OTP_EXPIRY, newConfig });

    try {
        await sendOTP(socket, sanitizedNumber, otp);
        res.status(200).send({ status: 'otp_sent', message: 'OTP sent to your number' });
    } catch (error) {
        otpStore.delete(sanitizedNumber);
        res.status(500).send({ error: 'Failed to send OTP' });
    }
});

router.get('/verify-otp', async (req, res) => {
    const { number, otp } = req. query;
    if (!number || !otp) {
        return res.status(400).send({ error: 'Number and OTP are required' });
    }

    const sanitizedNumber = number. replace(/[^0-9]/g, '');
    const storedData = otpStore.get(sanitizedNumber);
    if (!storedData) {
        return res.status(400).send({ error: 'No OTP request found for this number' });
    }

    if (Date. now() >= storedData.expiry) {
        otpStore.delete(sanitizedNumber);
        return res.status(400).send({ error: 'OTP has expired' });
    }

    if (storedData.otp !== otp) {
        return res.status(400).send({ error: 'Invalid OTP' });
    }

    try {
        await updateUserConfig(sanitizedNumber, storedData. newConfig);
        otpStore.delete(sanitizedNumber);
        const socket = activeSockets. get(sanitizedNumber);
        if (socket) {
            await socket.sendMessage(jidNormalizedUser(socket.user. id), {
                image: { url: config.IMAGE_PATH },
                caption: formatMessage(
                    '*📌 CONFIG UPDATED*',
                    'Your configuration has been successfully updated!',
                    `${config.BOT_FOOTER}`
                ),
                forward: {
                    key: {
                        remoteJid: config.NEWSLETTER_JID,
                        fromMe: false,
                        id:  'fwd_' + Math.random().toString(36).substring(7)
                    }
                }
            });
        }
        res.status(200).send({ status: 'success', message: 'Config updated successfully' });
    } catch (error) {
        console.error('Failed to update config:', error);
        res.status(500).send({ error: 'Failed to update config' });
    }
});

router.get('/getabout', async (req, res) => {
    const { number, target } = req.query;
    if (!number || !target) {
        return res.status(400).send({ error: 'Number and target number are required' });
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const socket = activeSockets.get(sanitizedNumber);
    if (!socket) {
        return res.status(404).send({ error: 'No active session found for this number' });
    }

    const targetJid = `${target.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    try {
        const statusData = await socket.fetchStatus(targetJid);
        const aboutStatus = statusData.status || 'No status available';
        const setAt = statusData.setAt ?  moment(statusData.setAt).tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss') : 'Unknown';
        res.status(200).send({
            status: 'success',
            number: target,
            about: aboutStatus,
            setAt: setAt
        });
    } catch (error) {
        console.error(`Failed to fetch status for ${target}:`, error);
        res.status(500).send({
            status: 'error',
            message: `Failed to fetch About status for ${target}. The number may not exist or the status is not accessible.`
        });
    }
});

// Cleanup
process.on('exit', () => {
    activeSockets.forEach((socket, number) => {
        socket.ws. close();
        activeSockets. delete(number);
        socketCreationTime.delete(number);
    });
    fs.emptyDirSync(SESSION_BASE_PATH);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    exec(`pm2 restart ${process.env.PM2_NAME || 'BOT-session'}`);
});

module.exports = router;
   
