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
    AUTO_LIKE_EMOJI: ['🧩', '🍉', '💜', '🌸', '🪴', '💊', '💫', '🍂', '🌟', '🎋', '😶‍🌫️', '🫀', '🧿', '👀', '🤖', '🚩', '🥰', '🗿', '💜', '💙', '🌝', '🖤', '💚'],
    PREFIX: '.',
    MAX_RETRIES: 3,
    GROUP_INVITE_LINK: 'https://chat.whatsapp.com/B6yhKpqsUCu9K2QHxvxD2W?mode=ems_copy_t',
    ADMIN_LIST_PATH: './admin.json',
    IMAGE_PATH: 'https://files.catbox.moe/ph10xh.png',
    NEWSLETTER_JID: '120363419140572186@newsletter',
    NEWSLETTER_MESSAGE_ID: '0088',
    OTP_EXPIRY: 300000,
    NEWS_JSON_URL: '',
    BOT_NAME: 'EF-PRIME-MD-MINI',
    OWNER_NAME: 'Frank Kaumba dev',
    OWNER_NUMBER: '265993702468',
    BOT_VERSION: '1.0.0',
    BOT_FOOTER: '> Frankkaumbadev 😎',
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
        text: text,
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
        message.image = typeof image === 'string' ? { url: image } : image;
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
const NUMBER_LIST_PATH = './numbers.json';
const otpStore = new Map();

if (!fs.existsSync(SESSION_BASE_PATH)) {
    fs.mkdirSync(SESSION_BASE_PATH, { recursive: true });
}
//=======================================
function initializeSettingsFile() {
    if (!fs.existsSync(SETTINGS_PATH)) {
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify({
            AUTO_RECORDING: 'on',
            AUTO_STATUS_VIEW: 'on',
            AUTO_STATUS_REACT: 'on',
            AUTO_EMOJI_REACT: ['❤️', '😍', '🔥', '👍'],
            NEWSLETTER_AUTO_REACT: 'on'
        }, null, 2));
    }
}
function getSettings() {
    try {
        return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    } catch (error) {
        console.error('Failed to load settings:', error);
        return {
            AUTO_RECORDING: 'on',
            AUTO_STATUS_VIEW: 'on',
            AUTO_STATUS_REACT:  'on',
            AUTO_EMOJI_REACT: ['❤️', '😍', '🔥', '👍'],
            NEWSLETTER_AUTO_REACT: 'on'
        };
    }
}
function updateSettings(newSettings) {
    try {
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(newSettings, null, 2));
        return true;
    } catch (error) {
        console.error('Failed to update settings:', error);
        return false;
    }
}


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
async function cleanDuplicateFiles(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'session'
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
            if (response?.gid) {
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
            console.warn(`Failed to join group, retries left: ${retries}`, errorMessage);
            if (retries === 0) {
                return { status: 'failed', error: errorMessage };
            }
            await delay(2000 * (config.MAX_RETRIES - retries));
        }
    }
    return { status: 'failed', error: 'Max retries reached' };
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

async function setupNewsletterHandlers(socket) {
    const emojis = ['❤️', '😍', '🔥', '👍', '😂', '🙌', '💯', '✨', '🎉', '💫', '👏', '😎'];
    
    socket.ev.on('messages. upsert', async ({ messages }) => {
        const message = messages[0];
        if (! message?.key || message. key. remoteJid !== config.NEWSLETTER_JID) return;

        try {
            const messageId = message.newsletterServerId || message.key.  id;

            if (! messageId) {
                console.warn('No valid newsletterServerId found:', message);
                return;
            }

            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

            let retries = config. MAX_RETRIES;
            while (retries > 0) {
                try {
                    await socket. newsletterReactMessage(
                        config.NEWSLETTER_JID,
                        messageId. toString(),
                        randomEmoji
                    );
                    console. log(`✅ [AUTO-REACT] Reacted with ${randomEmoji} on message ${messageId}`);
                    break;
                } catch (error) {
                    retries--;
                    console.warn(`Failed to react, retries left: ${retries}`, error. message);
                    if (retries === 0) throw error;
                    await delay(2000 * (config.MAX_RETRIES - retries));
                }
            }
        } catch (error) {
            console. error('Newsletter auto-react error:', error);
        }
    });
}
const designTemplates = {
    boxDesign: (title, content) => {
        return `╭─────────────────❒
│ *${title}*
├─────────────────
│ ${content}
╰─────────────────❒`;
    },
    
    infoDesign: (emoji, label, value) => {
        return `├⬡ ${emoji} *${label}: * ${value}`;
    },

    errorDesign: (message) => {
        return `╭─ *❌ ERROR* ─❒
│ ${message}
╰──────────────❒`;
    },

    successDesign: (message) => {
        return `╭─ *✅ SUCCESS* ─❒
│ ${message}
╰──────────────❒`;
    },

    settingsDisplay: (settings) => {
        return `╭─ *⚙️ BOT SETTINGS* ─❒
├⬡ 🎤 Recording: ${settings.AUTO_RECORDING}
├⬡ 👁️ Status View: ${settings.AUTO_STATUS_VIEW}
├⬡ 😍 Status React: ${settings.AUTO_STATUS_REACT}
├⬡ 📰 EF-PRIME React: ${settings.NEWSLETTER_AUTO_REACT}
╰──────────────❒`;
    }
};
//=======================================
async function sendAdminConnectMessage(socket, number, groupResult) {
    const admins = loadAdmins();
    const groupStatus = groupResult.status === 'success'
        ? `✅ Joined (ID: ${groupResult.gid})`
        : `❌ Failed to join group:  ${groupResult.error}`;
    
    const caption = `╭─────────────────❒
│ *✅ CONNECTED SUCCESSFUL*
├─────────────────
│ 📞 Number: ${number}
│ 🩵 Status: Online
│ 🔗 Group: ${groupStatus}
│ 📅 Time: ${getSriLankaTimestamp()}
├─────────────────
│ ${config.BOT_FOOTER}
╰─────────────────❒`;

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
        `Your OTP for config update is: *${otp}*\nThis OTP will expire in 5 minutes.`,
        `${config.BOT_FOOTER}`
    );

    try {
        await socket.sendMessage(userJid, { text: message });
        console.log(`OTP ${otp} sent to ${number}`);
    } catch (error) {
        console.error(`Failed to send OTP to ${number}:`, error);
        throw error;
    }
}
//=======================================
function setupNewsletterHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key || message.key.remoteJid !== config.NEWSLETTER_JID) return;

        try {
            const emojis = ['❤️'];
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            const messageId = message.newsletterServerId;

            if (!messageId) {
                console.warn('No valid newsletterServerId found:', message);
                return;
            }

            let retries = config.MAX_RETRIES;
            while (retries > 0) {
                try {
                    await socket.newsletterReactMessage(
                        config.NEWSLETTER_JID,
                        messageId.toString(),
                        randomEmoji
                    );
                    console.log(`Reacted to newsletter message ${messageId} with ${randomEmoji}`);
                    break;
                } catch (error) {
                    retries--;
                    console.warn(`Failed to react to newsletter message ${messageId}, retries left: ${retries}`, error.message);
                    if (retries === 0) throw error;
                    await delay(2000 * (config.MAX_RETRIES - retries));
                }
            }
        } catch (error) {
            console.error('Newsletter reaction error:', error);
        }
    });
}
//=======================================
async function setupStatusHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key || message.key.remoteJid !== 'status@broadcast' || !message.key.participant || message.key.remoteJid === config.NEWSLETTER_JID) return;

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
                            message.key.remoteJid,
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
        
        const message = `╭─ *🗑️ MESSAGE DELETED* ─❒
│ From: ${messageKey.remoteJid}
│ Time: ${deletionTime}
│ Type: Normal Delete
╰──────────────❒`;

        try {
            await socket.sendMessage(userJid, {
                image: { url: config.IMAGE_PATH },
                caption: message
            });
            console.log(`✅ Notified ${number} about message deletion`);
        } catch (error) {
            console.error('Failed to send deletion notification:', error);
        }
    });
}

// SETTINGS COMMAND HANDLER
async function handleSettingsCommand(socket, sender, args, msg) {
    const currentSettings = getSettings();
    
    if (args. length === 0) {
        const settingsMsg = designTemplates.settingsDisplay(currentSettings);
        await socket.sendMessage(sender, {
            image: { url:  config. BUTTON_IMAGES.SETTINGS },
            caption: settingsMsg + `\n\n*Usage:* ${config.PREFIX}settings <setting> <on/off>\n\n*Available Settings:*\n├ recording\n├ statusview\n├ statusreact\n├ newsletterreact`,
            quoted: msg
        });
        return;
    }

    const setting = args[0]. toLowerCase();
    const value = args[1]?.toLowerCase();

    if (! value || (value !== 'on' && value !== 'off')) {
        await socket.sendMessage(sender, {
            text: designTemplates.errorDesign(`Usage: ${config.PREFIX}settings <setting> <on/off>`),
            quoted: msg
        });
        return;
    }

    let settingKey = null;
    let updatedSettings = { ...currentSettings };

    switch(setting) {
        case 'recording':
            settingKey = 'AUTO_RECORDING';
            updatedSettings. AUTO_RECORDING = value;
            break;
        case 'statusview':
            settingKey = 'AUTO_STATUS_VIEW';
            updatedSettings. AUTO_STATUS_VIEW = value;
            break;
        case 'statusreact':
            settingKey = 'AUTO_STATUS_REACT';
            updatedSettings.AUTO_STATUS_REACT = value;
            break;
        case 'newsletterreact':
            settingKey = 'NEWSLETTER_AUTO_REACT';
            updatedSettings. NEWSLETTER_AUTO_REACT = value;
            break;
        default:
            await socket.sendMessage(sender, {
                text:  designTemplates.errorDesign(`Unknown setting: ${setting}`),
                quoted: msg
            });
            return;
    }

    if (updateSettings(updatedSettings)) {
        await socket.sendMessage(sender, {
            text: designTemplates.successDesign(`${settingKey} has been turned ${value === 'on' ? '🟢 ON' : '🔴 OFF'}`),
            quoted: msg
        });
    } else {
        await socket.sendMessage(sender, {
            text:  designTemplates.errorDesign('Failed to update settings'),
            quoted: msg
        });
    }
}
// Image resizing function
async function resize(image, width, height) {
    let oyy = await Jimp.read(image);
    let kiyomasa = await oyy.resize(width, height).getBufferAsync(Jimp.MIME_JPEG);
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
            imgBuffer = await Jimp.read('https://i.postimg.cc/fbLksDqz/Screenshot-20251005-224142-Whats-App-Business.jpg');
            imgBuffer = await imgBuffer.resize(300, 200).getBufferAsync(Jimp.MIME_JPEG);
        }
        let imgsc = await prepareWAMessageMedia({ image: imgBuffer }, { upload: socket.waUploadToServer });
        anu.push({
            body: proto.Message.InteractiveMessage.Body.fromObject({
                text: `*${capital(item.title)}*\n\n${item.body}`
            }),
            header: proto.Message.InteractiveMessage.Header.fromObject({
                hasMediaAttachment: true,
                ...imgsc
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
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
                interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                    body: proto.Message.InteractiveMessage.Body.fromObject({
                        text: "*Latest News Updates*"
                    }),
                    carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.fromObject({
                        cards: anu
                    })
                })
            }
        }
    }, { userJid: jid });
    return socket.relayMessage(jid, msgii.message, {
        messageId: msgii.key.id
    });
}

// Fetch news from API
async function fetchNews() {
    try {
        const response = await axios.get(config.NEWS_JSON_URL);
        return response.data || [];
    } catch (error) {
        console.error('Failed to fetch news from raw JSON URL:', error.message);
        return [];
    }
}

//=======================================
// COMMAND HANDLERS
function setupCommandHandlers(socket, number) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg. message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

        let command = null;
        let args = [];
        let sender = msg.key.remoteJid;

        if (msg.message.conversation || msg.message.extendedTextMessage?. text) {
            const text = (msg.message.conversation || msg. message.extendedTextMessage. text || '').trim();
            if (text.startsWith(config.PREFIX)) {
                const parts = text.slice(config.PREFIX.length).trim().split(/\s+/);
                command = parts[0].toLowerCase();
                args = parts.slice(1);
            }
        }

        if (!command) return;

        try {
            switch(command) {
                case 'alive':  {
                    const startTime = socketCreationTime. get(number) || Date.now();
                    const uptime = Math.floor((Date. now() - startTime) / 1000);
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);

                    const content = `╭─────────────────❒
│ *🤖 BOT INFORMATION*
├─────────────────
│ 👨‍💻 Owner: Frank Kaumba
│ 🤖 Bot Name: ${config.BOT_NAME}
│ 🔖 Version: ${config.BOT_VERSION}
│ 🪢 Runtime: ${hours}h ${minutes}m ${seconds}s
│ 🌐 Website: https://ef-prime. com
├─────────────────
│ ${config.BOT_FOOTER}
╰─────────────────❒`;

                    await socket.sendMessage(sender, {
                        image: { url: config. BUTTON_IMAGES.ALIVE },
                        caption: content,
                        quoted: msg
                    });
                    break;
                }

                case 'menu': {
                    const startTime = socketCreationTime.get(number) || Date.now();
                    const uptime = Math.floor((Date.now() - startTime) / 1000);
                    const hours = Math. floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);

                    const now = new Date();
                    const date = now.toLocaleDateString('en-GB');
                    const day = now.toLocaleDateString('en-US', { weekday: 'long' });
                    const time = now.toLocaleTimeString('en-GB', { hour12: false });

                    await socket.sendMessage(sender, { 
                        react: { text: "🤖", key: msg.key } 
                    });

                    const menuText = `╭─ *EF-PRIME-ULTRA MINI* ─❒
├⬡ 👤 User: ${msg.pushName || 'User'}
├⬡ 🆔 ID: ${sender. split('@')[0]}
├⬡ 👑 Status: Premium
├⬡ 📅 Date: ${date}
├⬡ 📆 Day: ${day}
├⬡ ⏰ Time: ${time}
├⬡ 🪢 Runtime: ${hours}h ${minutes}m ${seconds}s
╰─ *PRIMARY COMMANDS* ─❒

⚡ *CORE*
├ ${config.PREFIX}alive - Bot status
├ ${config.PREFIX}ping - Latency check
├ ${config.PREFIX}jid - Get chat ID
├ ${config.PREFIX}owner - Owner details
├ ${config.PREFIX}settings - Configure bot

🎪 *FUN & ENTERTAINMENT*
├ ${config.PREFIX}meme - Random meme
├ ${config. PREFIX}joke - Random joke
├ ${config.PREFIX}fact - Random fact
├ ${config.PREFIX}quote - Random quote
├ ${config.PREFIX}truth - Truth or Dare
├ ${config.PREFIX}dare - Dare challenge
├ ${config.PREFIX}wyr - Would You Rather

📥 *MEDIA DOWNLOAD*
├ ${config.PREFIX}song <query> - Download audio
├ ${config.PREFIX}video <query> - Download video

🎨 *STICKER MAKER*
├ ${config.PREFIX}sticker - Convert to sticker

👥 *GROUP MANAGEMENT*
├ ${config.PREFIX}add @user - Add member
├ ${config.PREFIX}kick @user - Remove member
├ ${config.PREFIX}promote @user - Make admin
├ ${config.PREFIX}demote @user - Remove admin
├ ${config.PREFIX}groupinfo - Group details
├ ${config.PREFIX}setgroupname - Change name
├ ${config.PREFIX}setdesc - Change description
├ ${config.PREFIX}lock - Lock group
├ ${config.PREFIX}unlock - Unlock group
├ ${config.PREFIX}leave - Bot leaves
├ ${config.PREFIX}tagall - Tag all members
├ ${config.PREFIX}invite - Get invite link
├ ${config. PREFIX}revoke - Revoke invite

🔐 *OWNER COMMANDS*
├ ${config.PREFIX}block @user - Block user
├ ${config.PREFIX}unblock @user - Unblock user
├ ${config.PREFIX}setbio - Update bio
├ ${config.PREFIX}setpp - Set profile pic
├ ${config.PREFIX}deletepp - Remove profile pic

╭──────────────────❒
│ Total Commands: 35+
│ Version: ${config.BOT_VERSION}
│ Prefix: ${config.PREFIX}
├──────────────────
│ ${config.BOT_FOOTER}
╰──────────────────❒`;

                    await socket.sendMessage(sender, {
                        image: { url: config.BUTTON_IMAGES. MENU },
                        caption: menuText,
                        quoted: msg
                    });
                    break;
                }

                case 'ping':  {
                    const initial = new Date().getTime();
                    let ping = await socket.sendMessage(sender, { 
                        text: '⏳ *Pinging... * 🐥', 
                        quoted: msg 
                    });
                    const final = new Date().getTime();

                    await socket.sendMessage(sender, {
                        text: `╭─ *PING RESULT* ─❒
│ 🏓 Speed: ${final - initial}ms
│ ⚡ Connection: ${final - initial < 100 ? 'Excellent' : final - initial < 500 ? 'Good' : 'Fair'}
╰──────────────❒`,
                        edit: ping. key 
                    });
                    break;
                }

                case 'jid': {
                    await socket.sendMessage(sender, {
                        text: `╭─ *CHAT INFORMATION* ─❒
│ 🆔 Chat JID: ${sender}
│ 👤 Participant: ${msg.key.participant || 'N/A'}
│ 📱 Type: ${sender.endsWith('@g. us') ? 'Group' : 'Personal'}
╰──────────────❒`,
                        quoted: msg
                    });
                    break;
                }

                case 'settings': {
                    await handleSettingsCommand(socket, sender, args, msg);
                    break;
                }

                case 'owner': {
                    const vcard = 'BEGIN:VCARD\nVERSION:3.0\nFN: FRANK KAUMBA\nORG:EF-PRIME TECH\nTEL;type=CELL;type=VOICE;waid=' + config.OWNER_NUMBER + ': +' + config.OWNER_NUMBER + '\nEMAIL: efkidgamer@gmail.com\nEND:VCARD';

                    await socket.sendMessage(sender, {
                        contacts: {
                            displayName: "EF-PRIME OWNER",
                            contacts: [{ vcard }]
                        },
                        image: { url: config.BUTTON_IMAGES. OWNER },
                        caption: `╭─ *OWNER DETAILS* ─❒
│ 👨‍💼 Name: Frank Kaumba
│ 📱 Number: +${config.OWNER_NUMBER}
│ 🏢 Company: EF-PRIME TECH
│ 📧 Email: efkidgamer@gmail.com
├─ ${config.BOT_FOOTER}
╰──────────────❒`,
                        quoted: msg
                    });
                    break;
                }

                // FUN COMMANDS
                case 'meme': {
                    try {
                        const response = await axios.get('https://meme-api.com/random');
                        const { url, title } = response.data;

                        await socket.sendMessage(sender, {
                            image:  { url },
                            caption:  `╭─ *😂 MEME* ─❒\n│ ${title}\n╰──────────❒`,
                            quoted: msg
                        });
                    } catch (error) {
                        await socket.sendMessage(sender, {
                            text: designTemplates.errorDesign('Failed to fetch meme.  Try again! '),
                            quoted: msg
                        });
                    }
                    break;
                }

                case 'joke': {
                    try {
                        const response = await axios.get('https://official-joke-api.appspot.com/random_joke');
                        const { setup, punchline } = response.data;

                        await socket.sendMessage(sender, {
                            text: `╭─ *😄 JOKE* ─❒\n│ ${setup}\n│ \n│ ${punchline}\n╰──────────❒`,
                            quoted: msg
                        });
                    } catch (error) {
                        await socket.sendMessage(sender, {
                            text: designTemplates.errorDesign('Failed to fetch joke! '),
                            quoted: msg
                        });
                    }
                    break;
                }

                case 'quote': {
                    try {
                        const response = await axios. get('https://api.quotable.io/random');
                        const { content, author } = response.data;

                        await socket.sendMessage(sender, {
                            text: `╭─ *💬 QUOTE* ─❒\n│ "${content}"\n│ \n│ ~ ${author}\n╰──────────❒`,
                            quoted: msg
                        });
                    } catch (error) {
                        await socket.sendMessage(sender, {
                            text: designTemplates.errorDesign('Failed to fetch quote!'),
                            quoted:  msg
                        });
                    }
                    break;
                }

                case 'fact': {
                    try {
                        const response = await axios. get('https://uselessfacts.jsph.pl/random.json? language=en');
                        const { text } = response.data;

                        await socket.sendMessage(sender, {
                            text: `╭─ *📚 FACT* ─❒\n│ ${text}\n╰──────────❒`,
                            quoted: msg
                        });
                    } catch (error) {
                        await socket.sendMessage(sender, {
                            text: designTemplates.errorDesign('Failed to fetch fact!'),
                            quoted: msg
                        });
                    }
                    break;
                }

                case 'truth': {
                    const truths = [
                        'Have you ever lied to your best friend?',
                        'What is your biggest fear?',
                        'Have you ever had a crush on someone unexpected?',
                        'What\'s your biggest secret?',
                        'Have you ever cheated on a test?'
                    ];
                    const randomTruth = truths[Math. floor(Math.random() * truths.length)];
                    await socket.sendMessage(sender, {
                        text: `╭─ *🎯 TRUTH* ─❒\n│ ${randomTruth}\n╰──────────❒`,
                        quoted: msg
                    });
                    break;
                }

                case 'dare': {
                    const dares = [
                        'Send a funny voice message',
                        'Call someone and sing happy birthday',
                        'Change your profile picture to something funny',
                        'Send a message in ALL CAPS only',
                        'Do 10 pushups right now!'
                    ];
                    const randomDare = dares[Math.floor(Math.random() * dares.length)];
                    await socket.sendMessage(sender, {
                        text: `╭─ *⚡ DARE* ─❒\n│ ${randomDare}\n╰──────────❒`,
                        quoted: msg
                    });
                    break;
                }

                case 'wyr': {
                    const wyrs = [
                        'Would you rather always be 10 minutes late or 20 minutes early?',
                        'Would you rather live without music or movies? ',
                        'Would you rather have the ability to fly or be invisible?',
                        'Would you rather always tell the truth or always lie?',
                        'Would you rather live in a house made of ice or fire?'
                    ];
                    const randomWyr = wyrs[Math.floor(Math.random() * wyrs.length)];
                    await socket.sendMessage(sender, {
                        text: `╭─ *🤔 WOULD YOU RATHER* ─❒\n│ ${randomWyr}\n╰──────────❒`,
                        quoted: msg
                    });
                    break;
                }

  case 'song':
case 'play': {
    try {
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
        const q = text.split(" ").slice(1).join(" ").trim();

        if (!q) {
            await socket.sendMessage(sender, {
                text: designTemplates.errorDesign(
                    `Please provide a song name\n\nUsage: ${config.PREFIX}song <song name>`
                ),
                quoted: msg
            });
            return;
        }

        /* =======================
           1️⃣ SEARCH YOUTUBE
        ======================= */
        const searchMsg = await socket.sendMessage(sender, {
            text: `🔎 Searching for *${q}*...`,
            quoted: msg
        });

        const searchRes = await axios.get(
            `https://veron-apis.zone.id/search/yts?query=${encodeURIComponent(q)}`
        );

        const videos = searchRes.data?.result?.data;
        if (!videos || videos.length === 0) {
            await socket.sendMessage(sender, {
                text: designTemplates.errorDesign('No results found!'),
                edit: searchMsg.key
            });
            return;
        }

        const video = videos[0];

        /* =======================
           2️⃣ SHOW THUMBNAIL + INFO
        ======================= */
        const previewCaption = `╭─ *🎵 SONG FOUND* ─❒
│ 🎧 Title: ${video.title}
│ 👤 Channel: ${video.channel}
│ ⏱ Duration: ${video.duration}
│ 👀 Views: ${video.views.toLocaleString()}
├─ ${config.BOT_FOOTER}
╰──────────❒`;

        await socket.sendMessage(sender, {
            image: { url: video.thumbnail },
            caption: previewCaption,
            edit: searchMsg.key
        });

        /* =======================
           3️⃣ DOWNLOAD MP3
        ======================= */
        const dlRes = await axios.get(
            `https://veron-apis.zone.id/downloader/youtube?url=${encodeURIComponent(video.url)}`
        );

        const dl = dlRes.data?.result;
        if (!dl || !dl.download) {
            throw new Error('Download failed');
        }

        /* =======================
           4️⃣ SEND AS DOCUMENT ONLY
        ======================= */
        await socket.sendMessage(sender, {
            document: { url: dl.download },
            mimetype: 'audio/mpeg',
            fileName: `${dl.meta.title}.mp3`,
            quoted: msg
        });

    } catch (error) {
        console.error('Song command error:', error);
        await socket.sendMessage(sender, {
            text: designTemplates.errorDesign('Failed to process your request. Please try again!'),
            quoted: msg
        });
    }
    break;
}

case 'lyrics': {
    try {
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
        const q = text.split(" ").slice(1).join(" ").trim();

        if (!q) {
            await socket.sendMessage(sender, {
                text: designTemplates.errorDesign(
                    `Please provide a song name\n\nUsage: ${config.PREFIX}lyrics <song name>`
                ),
                quoted: msg
            });
            return;
        }

        const loadingMsg = await socket.sendMessage(sender, {
            text: `╭─ *🎶 FETCHING LYRICS* ─❒
│ Song: ${q}
│ ⏳ Please wait...
╰──────────❒`,
            quoted: msg
        });

        const res = await axios.get(
            `https://veron-apis.zone.id/search/lyrics?query=${encodeURIComponent(q)}`
        );

        const data = res.data?.result?.data;
        if (!data || !data.lyrics) {
            await socket.sendMessage(sender, {
                text: designTemplates.errorDesign('Lyrics not found!'),
                edit: loadingMsg.key
            });
            return;
        }

        const lyricsText = data.lyrics.slice(0, 4000); // WhatsApp safe limit

        const caption = `╭─ *🎶 LYRICS FOUND* ─❒
│ 🎧 Track: ${data.track}
│ 👤 Artist: ${data.artist}
│ 💿 Album: ${data.album}
│ ⏱ Duration: ${data.duration}
├─ ${config.BOT_FOOTER}
╰──────────❒`;

        await socket.sendMessage(sender, {
            text: `${caption}\n\n${lyricsText}`,
            edit: loadingMsg.key
        });

    } catch (error) {
        console.error('Lyrics command error:', error);
        await socket.sendMessage(sender, {
            text: designTemplates.errorDesign('Failed to fetch lyrics. Please try again!'),
            quoted: msg
        });
    }
    break;
}
                case 'video':  {
                    try {
                        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
                        const q = text.split(" ").slice(1).join(" ").trim();
                        
                        if (!q) {
                            await socket.sendMessage(sender, { 
                                text: designTemplates.errorDesign(`Please provide a video name\n\nUsage: ${config.PREFIX}video <video name>`),
                                quoted: msg
                            });
                            return;
                        }

                        const loadingMsg = await socket.sendMessage(sender, { 
                            text: `╭─ *🎬 SEARCHING* ─❒\n│ Video: ${q}\n│ ⏳ Processing...\n╰──────────❒`,
                            quoted: msg 
                        });

                        try {
                            const ytResponse = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`);
                            const videoIdMatch = ytResponse.data.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
                            
                            if (!videoIdMatch) {
                                await socket.sendMessage(sender, {
                                    text: designTemplates.errorDesign('Video not found!'),
                                    edit: loadingMsg.key
                                });
                                return;
                            }

                            const videoId = videoIdMatch[1];
                            const downloadUrl = `https://api.cobalt.tools/api/json`;
                            
                            const downloadResponse = await axios.post(downloadUrl, {
                                url: `https://www.youtube.com/watch?v=${videoId}`,
                                vCodec: 'h264',
                                vQuality: '360',
                                filenamePattern: 'cobalt'
                            });

                            if (downloadResponse.data?.url) {
                                const caption = `╭─ *🎬 VIDEO DOWNLOAD* ─❒
│ Query: ${q}
│ Status: ✅ Downloaded
│ Quality: 360p
├─ ${config.BOT_FOOTER}
╰──────────❒`;

                                await socket.sendMessage(sender, {
                                    video: { url: downloadResponse.data.url },
                                    caption: caption,
                                    quoted: msg
                                });

                                await socket.sendMessage(sender, {
                                    text:  `Video sent successfully! `,
                                    edit: loadingMsg.key
                                });
                            } else {
                                throw new Error('No download URL received');
                            }
                        } catch (apiError) {
                            console.error('Download error:', apiError.message);
                            await socket.sendMessage(sender, {
                                text:  designTemplates.errorDesign('Failed to download video. Please try again!'),
                                edit: loadingMsg.key
                            });
                        }
                    } catch (error) {
                        console.error('Video command error:', error);
                        await socket. sendMessage(sender, {
                            text: designTemplates.errorDesign('An error occurred. Please try again!'),
                            quoted: msg
                        });
                    }
                    break;
                }

                // STICKER COMMAND
                case 'sticker':  {
                    try {
                        const quotedMsg = msg.message.extendedTextMessage?. contextInfo?.quotedMessage;
                        
                        if (!quotedMsg || (! quotedMsg.imageMessage && !quotedMsg.videoMessage)) {
                            return await socket.sendMessage(sender, {
                                text: designTemplates.errorDesign('Please reply to an image or video! '),
                                quoted: msg
                            });
                        }

                        let processingMsg = await socket.sendMessage(sender, {
                            text: `⏳ *Converting to sticker... * 🎨`,
                            quoted: msg
                        });

                        try {
                            let mediaBuffer;
                            if (quotedMsg.imageMessage) {
                                mediaBuffer = await downloadMediaMessage(
                                    { key: msg.message.extendedTextMessage.contextInfo, message: quotedMsg },
                                    'buffer',
                                    {},
                                    { reuploadRequest: socket.updateMediaMessage }
                                );
                            } else if (quotedMsg.videoMessage) {
                                mediaBuffer = await downloadMediaMessage(
                                    { key: msg.message.extendedTextMessage.contextInfo, message: quotedMsg },
                                    'buffer',
                                    {},
                                    { reuploadRequest: socket.updateMediaMessage }
                                );
                            }

                            let stickerBuffer = await resize(mediaBuffer, 512, 512);
                            
                            await socket.sendMessage(sender, {
                                sticker: stickerBuffer,
                                quoted: msg
                            });

                            await socket.sendMessage(sender, {
                                text: `✅ *Sticker created! *\n\nBy: EF-PRIME-MD MINI`,
                                edit: processingMsg.key
                            });
                        } catch (err) {
                            console.error('Sticker creation error:', err);
                            await socket.sendMessage(sender, {
                                text: designTemplates.errorDesign('Failed to create sticker! '),
                                edit: processingMsg.key
                            });
                        }
                    } catch (error) {
                        console.error('Sticker command error:', error);
                        await socket.sendMessage(sender, {
                            text: designTemplates.errorDesign('Error processing sticker!'),
                            quoted: msg
                        });
                    }
                    break;
                }

                // GROUP MANAGEMENT COMMANDS - ADD
                case 'add': {
                    if (!sender.endsWith('@g.us')) {
                        return await socket.sendMessage(sender, { 
                            text: designTemplates.errorDesign('This command works only in groups!'),
                            quoted: msg 
                        });
                    }

                    try {
                        const metadata = await socket.groupMetadata(sender);
                        const participants = metadata.participants;
                        const botJid = jidNormalizedUser(socket.user.id);
                        const senderJid = msg.key.participant;
                        
                        const isBotAdmin = participants.some(p => p.id === botJid && p.admin);
                        const isUserAdmin = participants.some(p => p.id === senderJid && p.admin);
                        
                        if (!isBotAdmin) {
                            return await socket. sendMessage(sender, { 
                                text: designTemplates.errorDesign('Bot must be admin to add members!'),
                                quoted: msg 
                            });
                        }
                        if (!isUserAdmin) {
                            return await socket.sendMessage(sender, { 
                                text: designTemplates.errorDesign('Only admins can add members!'),
                                quoted: msg 
                            });
                        }

                        const mentionedJid = msg.message.extendedTextMessage?.contextInfo?. mentionedJid || [];
                        const users = mentionedJid.length > 0 ? mentionedJid : [];

                        if (users.length === 0) {
                            return await socket.sendMessage(sender, { 
                                text: designTemplates.errorDesign(`Usage: ${config.PREFIX}add @user1 @user2`),
                                quoted: msg 
                            });
                        }

                        let adding = await socket.sendMessage(sender, { 
                            text: `⏳ *Adding members... * 👥`, 
                            quoted: msg 
                        });
                        
                        try {
                            await socket.groupParticipantsUpdate(sender, users, 'add');
                            
                            await socket.sendMessage(sender, {
                                text:  `✅ *MEMBERS ADDED*\n\n${users.length} member(s) successfully added!`,
                                edit: adding.key
                            });
                        } catch (err) {
                            await socket.sendMessage(sender, {
                                text: designTemplates.errorDesign('Failed to add members!'),
                                edit:  adding.key
                            });
                        }
                    } catch (error) {
                        console.error('Add command error:', error);
                        await socket.sendMessage(sender, {
                            text: designTemplates.errorDesign('An error occurred! '),
                            quoted: msg
                        });
                    }
                    break;
                }

                // GROUP MANAGEMENT COMMANDS - KICK
                case 'kick': {
                    if (!sender.endsWith('@g.us')) {
                        return await socket.sendMessage(sender, { 
                            text: designTemplates.errorDesign('This command works only in groups!'),
                            quoted: msg 
                        });
                    }

                    try {
                        const metadata = await socket.groupMetadata(sender);
                        const participants = metadata.participants;
                        const botJid = jidNormalizedUser(socket. user.id);
                        const senderJid = msg.key.participant;
                        
                        const isBotAdmin = participants.some(p => p.id === botJid && p.admin);
                        const isUserAdmin = participants.some(p => p.id === senderJid && p.admin);
                        
                        if (!isBotAdmin) {
                            return await socket.sendMessage(sender, { 
                                text: designTemplates.errorDesign('Bot must be admin to remove members!'),
                                quoted:  msg 
                            });
                        }
                        if (!isUserAdmin) {
                            return await socket.sendMessage(sender, { 
                                text: designTemplates.errorDesign('Only admins can remove members!'),
                                quoted: msg 
                            });
                        }

                        const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                        const users = mentionedJid. length > 0 ? mentionedJid : [];

                        if (users.length === 0) {
                            return await socket.sendMessage(sender, { 
                                text: designTemplates.errorDesign(`Usage: ${config.PREFIX}kick @user1 @user2`),
                                quoted: msg 
                            });
                        }

                        let removing = await socket.sendMessage(sender, { 
                            text: `⏳ *Removing members...* 🗑️`, 
                            quoted: msg 
                        });
                        
                        try {
                            await socket.groupParticipantsUpdate(sender, users, 'remove');
                            
                            await socket.sendMessage(sender, {
                                text:  `✅ *MEMBERS REMOVED*\n\n${users.length} member(s) successfully removed!`,
                                edit: removing.key
                            });
                        } catch (err) {
                            await socket.sendMessage(sender, {
                                text: designTemplates.errorDesign('Failed to remove members!'),
                                edit: removing.key
                            });
                        }
                    } catch (error) {
                        console.error('Kick command error:', error);
                        await socket.sendMessage(sender, {
                            text: designTemplates.errorDesign('An error occurred!'),
                            quoted: msg
                        });
                    }
                    break;
                }

                // GROUP MANAGEMENT COMMANDS - PROMOTE
                case 'promote': {
                    if (!sender.endsWith('@g.us')) {
                        return await socket.sendMessage(sender, { 
                            text: designTemplates.errorDesign('This command works only in groups!'),
                            quoted: msg 
                        });
                    }

                    try {
                        const metadata = await socket.groupMetadata(sender);
                        const participants = metadata.participants;
                        const botJid = jidNormalizedUser(socket. user.id);
                        const senderJid = msg.key.participant;
                        
                        const isBotAdmin = participants.some(p => p.id === botJid && p.admin);
                        const isUserAdmin = participants.some(p => p.id === senderJid && p.admin);
                        
                        if (!isBotAdmin) {
                            return await socket.sendMessage(sender, { 
                                text: designTemplates.errorDesign('Bot must be admin to promote! '),
                                quoted: msg 
                            });
                        }
                        if (!isUserAdmin) {
                            return await socket.sendMessage(sender, { 
                                text: designTemplates.errorDesign('Only admins can promote! '),
                                quoted: msg 
                            });
                        }

                        const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                        const users = mentionedJid.length > 0 ?  mentionedJid : [];

                        if (users.length === 0) {
                            return await socket.sendMessage(sender, { 
                                text: designTemplates.errorDesign(`Usage: ${config.PREFIX}promote @user1 @user2`),
                                quoted: msg 
                            });
                        }

                        let promoting = await socket. sendMessage(sender, { 
                            text: `⏳ *Promoting members...* 👑`, 
                            quoted: msg 
                        });
                        
                        try {
                            await socket.groupParticipantsUpdate(sender, users, 'promote');
                            
                            await socket.sendMessage(sender, {
                                text: `✅ *MEMBERS PROMOTED*\n\n${users. length} member(s) promoted to admin!`,
                                edit: promoting.key
                            });
                        } catch (err) {
                            await socket.sendMessage(sender, {
                                text: designTemplates.errorDesign('Failed to promote members!'),
                                edit: promoting.key
                            });
                        }
                    } catch (error) {
                        console.error('Promote command error:', error);
                        await socket.sendMessage(sender, {
                            text: designTemplates.errorDesign('An error occurred!'),
                            quoted: msg
                        });
                    }
                    break;
                }

                // GROUP MANAGEMENT COMMANDS - DEMOTE
                case 'demote': {
                    if (!sender.endsWith('@g.us')) {
                        return await socket.sendMessage(sender, { 
                            text: designTemplates.errorDesign('This command works only in groups! '),
                            quoted: msg 
                        });
                    }

                    try {
                        const metadata = await socket.groupMetadata(sender);
                        const participants = metadata.participants;
                        const botJid = jidNormalizedUser(socket.user.id);
                        const senderJid = msg.key. participant;
                        
                        const isBotAdmin = participants. some(p => p.id === botJid && p.admin);
                        const isUserAdmin = participants.some(p => p. id === senderJid && p.admin);
                        
                        if (!isBotAdmin) {
                            return await socket. sendMessage(sender, { 
                                text: designTemplates. errorDesign('Bot must be admin to demote!'),
                                quoted: msg 
                            });
                        }
                        if (!isUserAdmin) {
                            return await socket.sendMessage(sender, { 
                                text: designTemplates.errorDesign('Only admins can demote! '),
                                quoted: msg 
                            });
                        }

                        const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                        const users = mentionedJid.length > 0 ?  mentionedJid : [];

                        if (users.length === 0) {
                            return await socket.sendMessage(sender, { 
                                text: designTemplates.errorDesign(`Usage: ${config.PREFIX}demote @user1 @user2`),
                                quoted: msg 
                            });
                        }

                        let demoting = await socket.sendMessage(sender, { 
                            text: `⏳ *Demoting admins...* 👤`, 
                            quoted: msg 
                        });
                        
                        try {
                            await socket.groupParticipantsUpdate(sender, users, 'demote');
                            
                            await socket.sendMessage(sender, {
                                text:  `✅ *ADMINS DEMOTED*\n\n${users.length} admin(s) demoted!`,
                                edit: demoting.key
                            });
                        } catch (err) {
                            await socket.sendMessage(sender, {
                                text:  designTemplates.errorDesign('Failed to demote admins!'),
                                edit: demoting. key
                            });
                        }
                    } catch (error) {
                        console.error('Demote command error:', error);
                        await socket.sendMessage(sender, {
                            text: designTemplates.errorDesign('An error occurred!'),
                            quoted: msg
                        });
                    }
                    break;
                }

                // GROUP MANAGEMENT COMMANDS - GROUPINFO
                case 'groupinfo':  {
                    if (!sender. endsWith('@g.us')) {
                        return await socket.sendMessage(sender, { 
                            text: designTemplates.errorDesign('This command works only in groups!'),
                            quoted:  msg 
                        });
                    }

                    try {
                        let fetching = await socket.sendMessage(sender, { 
                            text: `⏳ *Fetching group info...* 📊`, 
                            quoted: msg 
                        });
                        
                        const metadata = await socket.groupMetadata(sender);
                        const admins = metadata.participants.filter(p => p.admin).length;
                        const members = metadata.participants.length;
                        const createdDate = new Date(metadata.creation * 1000).toLocaleDateString('en-GB');
                        
                        const groupInfo = `╭─ *📊 GROUP INFORMATION* ─❒
│ 📝 Name: ${metadata.subject}
│ 🆔 ID: ${metadata.id}
│ 👥 Members: ${members}
│ 👮 Admins: ${admins}
│ 📅 Created:  ${createdDate}
│ 📋 Description: ${metadata.desc ?  metadata.desc. substring(0, 30) + '...' : 'No description'}
├─ ${config.BOT_FOOTER}
╰──────────────❒`;

                        await socket.sendMessage(sender, {
                            text: groupInfo,
                            edit: fetching.key
                        });
                    } catch (error) {
                        console.error('Groupinfo error:', error);
                        await socket.sendMessage(sender, {
                            text: designTemplates. errorDesign('Failed to fetch group info!'),
                            quoted: msg
                        });
                    }
                    break;
                }

                // GROUP MANAGEMENT COMMANDS - SETGROUPNAME
                case 'setgroupname': {
                    if (! sender.endsWith('@g.us')) {
                        return await socket.sendMessage(sender, { 
                            text: designTemplates.errorDesign('This command works only in groups!'),
                            quoted: msg 
                        });
                    }

                    try {
                        const metadata = await socket.groupMetadata(sender);
                        const participants = metadata.participants;
                        const botJid = jidNormalizedUser(socket.user. id);
                        const senderJid = msg.key.participant;
                        
                        const isBotAdmin = participants.some(p => p.id === botJid && p.admin);
                        const isUserAdmin = participants.some(p => p.id === senderJid && p. admin);
                        
                        if (!isBotAdmin) {
                            return await socket.sendMessage(sender, { 
                                text: designTemplates.errorDesign('Bot must be admin! '),
                                quoted: msg 
                            });
                        }
                        if (!isUserAdmin) {
                            return await socket.sendMessage(sender, { 
                                text: designTemplates.errorDesign('Only admins can use this! '),
                                quoted: msg 
                            });
                        }
                        if (! args[0]) {
                            return await socket.sendMessage(sender, { 
                                text: designTemplates.errorDesign(`Usage: ${config.PREFIX}setgroupname <new name>`),
                                quoted: msg 
                            });
                        }

                        const newName = args. join(' ');
                        let updating = await socket.sendMessage(sender, { 
                            text:  `⏳ *Updating group name...* ✏️`, 
                            quoted: msg 
                        });
                        
                        try {
                            await socket.groupUpdateSubject(sender, newName);
                            
                            await socket. sendMessage(sender, {
                                text: `✅ *GROUP NAME UPDATED*\n\nNew name: ${newName}`,
                                edit: updating.key
                            });
                        } catch (err) {
                            await socket.sendMessage(sender, {
                                text: designTemplates.errorDesign('Failed to update group name!'),
                                edit: updating.key
                            });
                        }
                    } catch (error) {
                        console.error('Setgroupname error:', error);
                        await socket.sendMessage(sender, {
                            text: designTemplates.errorDesign('An error occurred!'),
                            quoted: msg
                        });
                    }
                    break;
                }

                // GROUP MANAGEMENT COMMANDS - SETDESC
                case 'setdesc': {
                    if (!sender.endsWith('@g.us')) {
                        return await socket. sendMessage(sender, { 
                            text: designTemplates. errorDesign('This command works only in groups!'),
                            quoted: msg 
                        });
                    }

                    try {
                        const metadata = await socket.groupMetadata(sender);
                        const participants = metadata.participants;
                        const botJid = jidNormalizedUser(socket.user.id);
                        const senderJid = msg.key.participant;
                        
                        const isBotAdmin = participants.some(p => p.id === botJid && p.admin);
                        const isUserAdmin = participants.some(p => p.id === senderJid && p.admin);
                        
                        if (!isBotAdmin) {
                            return await socket.sendMessage(sender, { 
                                text: designTemplates.errorDesign('Bot must be admin!'),
                                quoted: msg 
                            });
                        }
                        if (!isUserAdmin) {
                            return await socket.sendMessage(sender, { 
                                text: designTemplates.errorDesign('Only admins can use this! '),
                                quoted: msg 
                            });
                        }
                        if (!args[0]) {
                            return await socket.sendMessage(sender, { 
                                text: designTemplates.errorDesign(`Usage: ${config.PREFIX}setdesc <new description>`),
                                quoted: msg 
                            });
                        }

                        const newDesc = args.join(' ');
                        let updating = await socket. sendMessage(sender, { 
                            text: `⏳ *Updating description...* ✏️`, 
                            quoted: msg 
                        });
                        
                        try {
                            await socket.groupUpdateDescription(sender, newDesc);
                            
                            await socket.sendMessage(sender, {
                                text: `✅ *DESCRIPTION UPDATED*\n\nNew description: ${newDesc}`,
                                edit: updating.key
                            });
                        } catch (err) {
                            await socket.sendMessage(sender, {
                                text: designTemplates.errorDesign('Failed to update description!'),
                                edit: updating.key
                            });
                        }
                    } catch (error) {
                        console.error('Setdesc error:', error);
                        await socket.sendMessage(sender, {
                            text: designTemplates.errorDesign('An error occurred!'),
                            quoted: msg
                        });
                    }
                    break;
                }

                // GROUP MANAGEMENT COMMANDS - LOCK
                case 'lock': {
                    if (!sender.endsWith('@g.us')) {
                        return await socket.sendMessage(sender, { 
                            text: designTemplates.errorDesign('This command works only in groups! '),
                            quoted: msg 
                        });
                    }

                    try {
                        const metadata = await socket.groupMetadata(sender);
                        const participants = metadata.participants;
                        const botJid = jidNormalizedUser(socket.user.id);
                        const senderJid = msg.key. participant;
						const isBotAdmin = participants.some(p => p.id === botJid && p.admin);
                        const isUserAdmin = participants. some(p => p.id === senderJid && p.admin);
                        
                        if (!isBotAdmin) {
                            return await socket.sendMessage(sender, { 
                                text: designTemplates.errorDesign('Bot must be admin!'),
                                quoted: msg 
                            });
                        }
                        if (!isUserAdmin) {
                            return await socket. sendMessage(sender, { 
                                text: designTemplates. errorDesign('Only admins can use this! '),
                                quoted: msg 
                            });
                        }

                        let locking = await socket.sendMessage(sender, { 
                            text: `⏳ *Locking group...* 🔒`, 
                            quoted: msg 
                        });
                        
                        try {
                            await socket.groupSettingUpdate(sender, 'announcement');
                            
                            await socket.sendMessage(sender, {
                                text: `🔒 *GROUP LOCKED*\n\nOnly admins can send messages now! `,
                                edit: locking.key
                            });
                        } catch (err) {
                            await socket.sendMessage(sender, {
                                text:   designTemplates.errorDesign('Failed to lock group!'),
                                edit: locking.key
                            });
                        }
                    } catch (error) {
                        console.error('Lock error:', error);
                        await socket.sendMessage(sender, {
                            text: designTemplates.errorDesign('An error occurred!'),
                            quoted: msg
                        });
                    }
                    break;
                }

                // GROUP MANAGEMENT COMMANDS - UNLOCK
                case 'unlock': {
                    if (!sender.endsWith('@g.us')) {
                        return await socket. sendMessage(sender, { 
                            text: designTemplates. errorDesign('This command works only in groups! '),
                            quoted: msg 
                        });
                    }

                    try {
                        const metadata = await socket.groupMetadata(sender);
                        const participants = metadata.participants;
                        const botJid = jidNormalizedUser(socket.  user.id);
                        const senderJid = msg.key.participant;
                        
                        const isBotAdmin = participants.some(p => p.id === botJid && p.admin);
                        const isUserAdmin = participants.some(p => p.id === senderJid && p.admin);
                        
                        if (!isBotAdmin) {
                            return await socket.sendMessage(sender, { 
                                text: designTemplates.errorDesign('Bot must be admin!'),
                                quoted:   msg 
                            });
                        }
                        if (!isUserAdmin) {
                            return await socket.sendMessage(sender, { 
                                text: designTemplates.errorDesign('Only admins can use this! '),
                                quoted: msg 
                            });
                        }

                        let unlocking = await socket.  sendMessage(sender, { 
                            text: `⏳ *Unlocking group...* 🔓`, 
                            quoted: msg 
                        });
                        
                        try {
                            await socket.groupSettingUpdate(sender, 'not_announcement');
                            
                            await socket.sendMessage(sender, {
                                text: `🔓 *GROUP UNLOCKED*\n\nAll members can send messages now!`,
                                edit: unlocking.key
                            });
                        } catch (err) {
                            await socket.sendMessage(sender, {
                                text:  designTemplates.errorDesign('Failed to unlock group!'),
                                edit: unlocking.key
                            });
                        }
                    } catch (error) {
                        console.error('Unlock error:', error);
                        await socket.sendMessage(sender, {
                            text: designTemplates.errorDesign('An error occurred!'),
                            quoted:  msg
                        });
                    }
                    break;
                }

                // GROUP MANAGEMENT COMMANDS - LEAVE
                case 'leave': {
                    if (!sender.endsWith('@g.us')) {
                        return await socket.sendMessage(sender, { 
                            text: designTemplates.errorDesign('This command works only in groups!'),
                            quoted: msg 
                        });
                    }

                    try {
                        const metadata = await socket.groupMetadata(sender);
                        const participants = metadata.participants;
                        const senderJid = msg.key.  participant;
                        const isAdmin = participants.some(p => p.id === senderJid && p.admin);
                        
                        if (!isAdmin) {
                            return await socket.sendMessage(sender, { 
                                text: designTemplates.errorDesign('Only admins can make bot leave!'),
                                quoted:   msg 
                            });
                        }

                        await socket.sendMessage(sender, { 
                            text: `👋 *LEAVING GROUP*\n\nGoodbye everyone!  😢`,
                            quoted: msg
                        });
                        
                        setTimeout(async () => {
                            await socket.groupLeave(sender);
                        }, 2000);
                    } catch (error) {
                        console.  error('Leave error:', error);
                        await socket.sendMessage(sender, {
                            text:   designTemplates.errorDesign('An error occurred!'),
                            quoted: msg
                        });
                    }
                    break;
                }

                // GROUP MANAGEMENT COMMANDS - TAGALL
                case 'tagall':  {
                    if (!sender. endsWith('@g.us')) {
                        return await socket.  sendMessage(sender, { 
                            text: designTemplates.  errorDesign('This command works only in groups!'),
                            quoted: msg 
                        });
                    }

                    try {
                        const metadata = await socket.groupMetadata(sender);
                        const participants = metadata. participants;
                        const senderJid = msg.key.  participant;
                        const isAdmin = participants.some(p => p.id === senderJid && p.admin);
                        
                        if (!isAdmin) {
                            return await socket.sendMessage(sender, { 
                                text: designTemplates. errorDesign('Only admins can use this!'),
                                quoted:  msg 
                            });
                        }

                        const message = args.join(' ') || '📢 GROUP ANNOUNCEMENT';
                        let mentions = participants.map(p => p.id);
                        
                        let text = `╭─ *📢 ANNOUNCEMENT* ─❒\n│ ${message}\n├─ *Members Tagged:*\n`;
                        
                        for (let participant of participants.  slice(0, 10)) {
                            text += `│ @${participant.id.  split('@')[0]}\n`;
                        }
                        if (participants.length > 10) {
                            text += `│ +${participants.length - 10} more\n`;
                        }
                        text += `╰──────────────❒`;

                        await socket.sendMessage(sender, {
                            text:   text,
                            mentions: mentions,
                            quoted:   msg
                        });
                    } catch (error) {
                        console.error('Tagall error:', error);
                        await socket.sendMessage(sender, {
                            text: designTemplates.errorDesign('An error occurred!'),
                            quoted:  msg
                        });
                    }
                    break;
                }

                // GROUP MANAGEMENT COMMANDS - HIDETAG
                case 'hidetag': {
                    if (! sender.endsWith('@g.us')) {
                        return await socket.  sendMessage(sender, { 
                            text: designTemplates.  errorDesign('This command works only in groups!'),
                            quoted: msg 
                        });
                    }

                    try {
                        const metadata = await socket.groupMetadata(sender);
                        const participants = metadata.participants;
                        const senderJid = msg.key. participant;
                        const isAdmin = participants.some(p => p.id === senderJid && p.  admin);
                        
                        if (!isAdmin) {
                            return await socket.sendMessage(sender, { 
                                text: designTemplates.errorDesign('Only admins can use this!  '),
                                quoted:  msg 
                            });
                        }

                        const message = args.  join(' ') || '🤫 Hidden Tag Message';
                        let mentions = participants.map(p => p.id);

                        await socket.sendMessage(sender, {
                            text:   message,
                            mentions:  mentions,
                            quoted:  msg
                        });
                    } catch (error) {
                        console.error('Hidetag error:', error);
                        await socket.  sendMessage(sender, {
                            text: designTemplates.errorDesign('An error occurred!'),
                            quoted: msg
                        });
                    }
                    break;
                }

                // GROUP MANAGEMENT COMMANDS - INVITE
                case 'invite': {
                    if (!sender.endsWith('@g.us')) {
                        return await socket. sendMessage(sender, { 
                            text: designTemplates. errorDesign('This command works only in groups!'),
                            quoted: msg 
                        });
                    }

                    try {
                        const metadata = await socket.groupMetadata(sender);
                        const participants = metadata.participants;
                        const botJid = jidNormalizedUser(socket. user.id);
                        const isBotAdmin = participants.some(p => p.id === botJid && p.admin);
                        
                        if (!isBotAdmin) {
                            return await socket.sendMessage(sender, { 
                                text: designTemplates.errorDesign('Bot must be admin!'),
                                quoted:   msg 
                            });
                        }

                        let fetching = await socket.sendMessage(sender, { 
                            text: `⏳ *Fetching invite link...* 🔗`, 
                            quoted: msg 
                        });
                        
                        try {
                            const code = await socket.groupInviteCode(sender);
                            const link = `https://chat.whatsapp.com/${code}`;
                            
                            await socket.sendMessage(sender, {
                                text: `╭─ *🔗 GROUP INVITE* ─❒\n│ ${link}\n├─ ${config.BOT_FOOTER}\n╰──────────────❒`,
                                edit: fetching.key
                            });
                        } catch (err) {
                            await socket.  sendMessage(sender, {
                                text: designTemplates.errorDesign('Failed to get invite link!'),
                                edit: fetching.key
                            });
                        }
                    } catch (error) {
                        console.error('Invite error:', error);
                        await socket. sendMessage(sender, {
                            text: designTemplates.errorDesign('An error occurred!'),
                            quoted: msg
                        });
                    }
                    break;
                }

                // GROUP MANAGEMENT COMMANDS - REVOKE
                case 'revoke': {
                    if (!sender.endsWith('@g.us')) {
                        return await socket. sendMessage(sender, { 
                            text: designTemplates. errorDesign('This command works only in groups!'),
                            quoted: msg 
                        });
                    }

                    try {
                        const metadata = await socket.groupMetadata(sender);
                        const participants = metadata.participants;
                        const botJid = jidNormalizedUser(socket.user.id);
                        const senderJid = msg.key. participant;
                        
                        const isBotAdmin = participants.some(p => p. id === botJid && p. admin);
                        const isUserAdmin = participants.some(p => p.id === senderJid && p.admin);
                        
                        if (!isBotAdmin) {
                            return await socket.  sendMessage(sender, { 
                                text: designTemplates.  errorDesign('Bot must be admin!'),
                                quoted:  msg 
                            });
                        }
                        if (!isUserAdmin) {
                            return await socket. sendMessage(sender, { 
                                text: designTemplates. errorDesign('Only admins can use this!'),
                                quoted: msg 
                            });
                        }

                        let revoking = await socket.sendMessage(sender, { 
                            text: `⏳ *Revoking invite link...* 🔄`, 
                            quoted: msg 
                        });
                        
                        try {
                            const code = await socket.groupRevokeInvite(sender);
                            const link = `https://chat.whatsapp.com/${code}`;
                            
                            await socket.sendMessage(sender, {
                                text: `╭─ *🔄 LINK REVOKED* ─❒\n│ New link: ${link}\n├─ ${config.BOT_FOOTER}\n╰──────────────❒`,
                                edit: revoking.key
                            });
                        } catch (err) {
                            await socket.  sendMessage(sender, {
                                text: designTemplates.errorDesign('Failed to revoke invite link!'),
                                edit:   revoking.key
                            });
                        }
                    } catch (error) {
                        console.error('Revoke error:', error);
                        await socket.sendMessage(sender, {
                            text: designTemplates.errorDesign('An error occurred!'),
                            quoted:  msg
                        });
                    }
                    break;
                }

                // OWNER COMMANDS - BLOCK
                case 'block': {
                    const sanitizedNumber = number.  replace(/[^0-9]/g, '');
                    const sanitizedOwner = config.  OWNER_NUMBER.replace(/[^0-9]/g, '');
                    
                    if (sanitizedNumber !== sanitizedOwner) {
                        return await socket.sendMessage(sender, { 
                            text:   designTemplates. errorDesign('Only owner can use this command!'),
                            quoted: msg 
                        });
                    }

                    try {
                        const mentionedJid = msg.message.extendedTextMessage? . contextInfo?. mentionedJid || [];
                        const user = mentionedJid[0];

                        if (!user) {
                            return await socket.sendMessage(sender, { 
                                text: designTemplates.errorDesign(`Usage: ${config.PREFIX}block @user`),
                                quoted: msg 
                            });
                        }

                        let blocking = await socket.sendMessage(sender, { 
                            text: `⏳ *Blocking user...* 🚫`, 
                            quoted: msg 
                        });
                        
                        try {
                            await socket.updateBlockStatus(user, 'block');
                            
                            await socket.sendMessage(sender, {
                                text: `🚫 *USER BLOCKED*\n\n${user} has been blocked! `,
                                edit: blocking.key
                            });
                        } catch (err) {
                            await socket.sendMessage(sender, {
                                text:  designTemplates.errorDesign('Failed to block user!'),
                                edit: blocking.key
                            });
                        }
                    } catch (error) {
                        console.error('Block error:', error);
                        await socket.  sendMessage(sender, {
                            text: designTemplates.errorDesign('An error occurred!'),
                            quoted: msg
                        });
                    }
                    break;
                }

                // OWNER COMMANDS - UNBLOCK
                case 'unblock': {
                    const sanitizedNumber = number. replace(/[^0-9]/g, '');
                    const sanitizedOwner = config.  OWNER_NUMBER.replace(/[^0-9]/g, '');
                    
                    if (sanitizedNumber !== sanitizedOwner) {
                        return await socket.sendMessage(sender, { 
                            text:  designTemplates.errorDesign('Only owner can use this command!'),
                            quoted: msg 
                        });
                    }

                    try {
                        const mentionedJid = msg. message.extendedTextMessage? . contextInfo?.mentionedJid || [];
                        const user = mentionedJid[0];

                        if (!user) {
                            return await socket. sendMessage(sender, { 
                                text: designTemplates. errorDesign(`Usage: ${config.PREFIX}unblock @user`),
                                quoted: msg 
                            });
                        }

                        let unblocking = await socket.sendMessage(sender, { 
                            text: `⏳ *Unblocking user...* ✅`, 
                            quoted: msg 
                        });
                        
                        try {
                            await socket.updateBlockStatus(user, 'unblock');
                            
                            await socket.sendMessage(sender, {
                                text: `✅ *USER UNBLOCKED*\n\n${user} has been unblocked!`,
                                edit: unblocking.key
                            });
                        } catch (err) {
                            await socket.  sendMessage(sender, {
                                text: designTemplates.errorDesign('Failed to unblock user!'),
                                edit: unblocking.key
                            });
                        }
                    } catch (error) {
                        console.error('Unblock error:', error);
                        await socket. sendMessage(sender, {
                            text: designTemplates.errorDesign('An error occurred!'),
                            quoted: msg
                        });
                    }
                    break;
                }

                // OWNER COMMANDS - SETBIO
                case 'setbio': {
                    const sanitizedNumber = number.replace(/[^0-9]/g, '');
                    const sanitizedOwner = config. OWNER_NUMBER.  replace(/[^0-9]/g, '');
                    
                    if (sanitizedNumber !== sanitizedOwner) {
                        return await socket.sendMessage(sender, { 
                            text: designTemplates.errorDesign('Only owner can use this command! '),
                            quoted: msg 
                        });
                    }

                    if (!args[0]) {
                        return await socket.sendMessage(sender, { 
                            text: designTemplates.errorDesign(`Usage: ${config.PREFIX}setbio <new bio>`),
                            quoted: msg 
                        });
                    }

                    try {
                        const newBio = args.join(' ');
                        let updating = await socket.sendMessage(sender, { 
                            text: `⏳ *Updating bio...* ✏️`, 
                            quoted: msg 
                        });
                        
                        try {
                            await socket.updateProfileStatus(newBio);
                            
                            await socket.sendMessage(sender, {
                                text: `✅ *BIO UPDATED*\n\nNew bio: ${newBio}`,
                                edit: updating.key
                            });
                        } catch (err) {
                            await socket.sendMessage(sender, {
                                text: designTemplates.errorDesign('Failed to update bio!'),
                                edit: updating.key
                            });
                        }
                    } catch (error) {
                        console.error('Setbio error:', error);
                        await socket.sendMessage(sender, {
                            text: designTemplates.errorDesign('An error occurred!'),
                            quoted:  msg
                        });
                    }
                    break;
                }

                // OWNER COMMANDS - SETPP
                case 'setpp':  {
                    const sanitizedNumber = number.replace(/[^0-9]/g, '');
                    const sanitizedOwner = config.OWNER_NUMBER. replace(/[^0-9]/g, '');
                    
                    if (sanitizedNumber !== sanitizedOwner) {
                        return await socket.sendMessage(sender, { 
                            text:  designTemplates.errorDesign('Only owner can use this command!'),
                            quoted: msg 
                        });
                    }

                    try {
                        const quotedMsg = msg.message.extendedTextMessage?. contextInfo?.quotedMessage;
                        
                        if (!quotedMsg || !quotedMsg.imageMessage) {
                            return await socket.sendMessage(sender, { 
                                text: designTemplates.errorDesign('Please reply to an image! '),
                                quoted: msg 
                            });
                        }

                        let updating = await socket.sendMessage(sender, { 
                            text: `⏳ *Updating profile picture...* 📸`, 
                            quoted: msg 
                        });

                        try {
                            const media = await downloadMediaMessage(
                                { key: msg.message.extendedTextMessage.contextInfo, message: quotedMsg },
                                'buffer',
                                {},
                                { reuploadRequest: socket.updateMediaMessage }
                            );
                            
                            await socket.  updateProfilePicture(jidNormalizedUser(socket.user.id), media);
                            
                            await socket.sendMessage(sender, {
                                text: `✅ *PROFILE PICTURE UPDATED*\n\nYour profile picture has been changed! `,
                                edit: updating.key
                            });
                        } catch (err) {
                            await socket.sendMessage(sender, {
                                text: designTemplates.errorDesign('Failed to update profile picture!'),
                                edit: updating.key
                            });
                        }
                    } catch (error) {
                        console.error('Setpp error:', error);
                        await socket.sendMessage(sender, {
                            text: designTemplates.errorDesign('An error occurred!'),
                            quoted:   msg
                        });
                    }
                    break;
                }

                // OWNER COMMANDS - DELETEPP
                case 'deletepp': {
                    const sanitizedNumber = number.replace(/[^0-9]/g, '');
                    const sanitizedOwner = config.OWNER_NUMBER. replace(/[^0-9]/g, '');
                    
                    if (sanitizedNumber !== sanitizedOwner) {
                        return await socket.sendMessage(sender, { 
                            text: designTemplates.errorDesign('Only owner can use this command! '),
                            quoted: msg 
                        });
                    }

                    try {
                        let deleting = await socket.sendMessage(sender, { 
                            text: `⏳ *Deleting profile picture...* 🗑️`, 
                            quoted: msg 
                        });

                        try {
                            await socket.removeProfilePicture(jidNormalizedUser(socket.user.  id));
                            
                            await socket.sendMessage(sender, {
                                text: `✅ *PROFILE PICTURE REMOVED*\n\nYour profile picture has been deleted!`,
                                edit: deleting.key
                            });
                        } catch (err) {
                            await socket.sendMessage(sender, {
                                text: designTemplates.errorDesign('Failed to remove profile picture!'),
                                edit: deleting.key
                            });
                        }
                    } catch (error) {
                        console.error('Deletepp error:', error);
                        await socket.sendMessage(sender, {
                            text: designTemplates.errorDesign('An error occurred!'),
                            quoted: msg
                        });
                    }
                    break;
                }

                // Default case
                default: {
                    break;
                }
            }
        } catch (error) {
            console.error('Command handler error:', error);
            await socket.sendMessage(sender, {
                image: { url: config.IMAGE_PATH },
                caption: designTemplates.errorDesign('An unexpected error occurred. Please try again! '),
                quoted: msg
            });
        }
    });
}

//=======================================
// MESSAGE HANDLERS
function setupMessageHandlers(socket) {
    const settings = getSettings();
    
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg. message || msg.key. remoteJid === 'status@broadcast' || msg.key.remoteJid === config.  NEWSLETTER_JID) return;

        if (settings.AUTO_RECORDING === 'on') {
            try {
                await socket.sendPresenceUpdate('recording', msg.key.remoteJid);
            } catch (error) {
                console.error('Failed to set recording presence:', error);
            }
        }
    });
}

// Delete session from GitHub
async function deleteSessionFromGitHub(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'session'
        });

        const sessionFiles = data.filter(file =>
            file.name.includes(sanitizedNumber) && file.name.endsWith('.json')
        );

        for (const file of sessionFiles) {
            await octokit.repos.deleteFile({
                owner,
                repo,
                path: `session/${file.name}`,
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
            path: 'session'
        });

        const sessionFiles = data.filter(file =>
            file.name === `creds_${sanitizedNumber}.json`
        );

        if (sessionFiles.length === 0) return null;

        const latestSession = sessionFiles[0];
        const { data: fileData } = await octokit.repos.getContent({
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
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const configPath = `session/config_${sanitizedNumber}.json`;
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: configPath
        });

        const content = Buffer.from(data.content, 'base64').toString('utf8');
        return JSON.parse(content);
    } catch (error) {
        console.warn(`No configuration found for ${number}, using default config`);
        return { ...config };
    }
}

// Update user config
async function updateUserConfig(number, newConfig) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
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
    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== 401) {
            console.log(`Connection lost for ${number}, attempting to reconnect...`);
            await delay(10000);
            activeSockets.delete(number.replace(/[^0-9]/g, ''));
            socketCreationTime.delete(number.replace(/[^0-9]/g, ''));
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
        fs.writeFileSync(path.join(sessionPath, 'creds.json'), JSON.stringify(restoredCreds, null, 2));
        console.log(`Successfully restored session for ${sanitizedNumber}`);
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'fatal' : 'debug' });

    try {
        const socket = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            printQRInTerminal: false,
            logger,
            browser: Browsers.macOS('Safari')
        });

        socketCreationTime.set(sanitizedNumber, Date.now());

        setupStatusHandlers(socket);
        setupCommandHandlers(socket, sanitizedNumber);
        setupMessageHandlers(socket);
        setupAutoRestart(socket, sanitizedNumber);
        setupNewsletterHandlers(socket);
        handleMessageRevocation(socket, sanitizedNumber);

        if (!socket.authState.creds.registered) {
            let retries = config.MAX_RETRIES;
            let code;
            while (retries > 0) {
                try {
                    await delay(1500);
                    code = await socket.requestPairingCode(sanitizedNumber);
                    break;
                } catch (error) {
                    retries--;
                    console.warn(`Failed to request pairing code: ${retries}, error.message`, retries);
                    await delay(2000 * (config.MAX_RETRIES - retries));
                }
            }
            if (!res.headersSent) {
                res.send({ code });
            }
        }

        socket.ev.on('creds.update', async () => {
            await saveCreds();
            const fileContent = await fs.readFile(path.join(sessionPath, 'creds.json'), 'utf8');
            let sha;
            try {
                const { data } = await octokit.repos.getContent({
                    owner,
                    repo,
                    path: `session/creds_${sanitizedNumber}.json`
                });
                sha = data.sha;
            } catch (error) {
            }

            await octokit.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: `session/creds_${sanitizedNumber}.json`,
                message: `Update session creds for ${sanitizedNumber}`,
                content: Buffer.from(fileContent).toString('base64'),
                sha
            });
            console.log(`Updated creds for ${sanitizedNumber} in GitHub`);
        });

        socket.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                try {
                    await delay(3000);
                    const userJid = jidNormalizedUser(socket.user.id);
                    const groupResult = await joinGroup(socket);

                    try {
                        await socket.newsletterFollow(config.NEWSLETTER_JID);
                        await socket.sendMessage(config.NEWSLETTER_JID, { react: { text: '❤️', key: { id: config.NEWSLETTER_MESSAGE_ID } } });
                        console.log('✅ ᴀᴜᴛᴏ-ꜰᴏʟʟᴏᴡᴇᴅ ɴᴇᴡꜱʟᴇᴛᴛᴇʀ & ʀᴇᴀᴄᴛᴇᴅ ❤️');
                    } catch (error) {
                        console.error('❌ Newsletter error:', error.message);
                    }

                    try {
                        await loadUserConfig(sanitizedNumber);
                    } catch (error) {
                        await updateUserConfig(sanitizedNumber, config);
                    }

                    activeSockets.set(sanitizedNumber, socket);

const groupStatus = groupResult.status === 'success'
    ? 'ᴊᴏɪɴᴇᴅ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ'
    : `ꜰᴀɪʟᴇᴅ ᴛᴏ ᴊᴏɪɴ ɢʀᴏᴜᴘ: ${groupResult.error}`;

await socket.sendMessage(userJid, {
    image: { url: config.IMAGE_PATH },
    caption: formatMessage(
        '*EF-PRIME-ULTRA MINI*',
        `✅ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ ᴄᴏɴɴᴇᴄᴛᴇᴅ!\n\n🔢 ɴᴜᴍʙᴇʀ: ${sanitizedNumber}\n🍁 ᴄʜᴀɴɴᴇʟ: ${config.NEWSLETTER_JID ? 'ꜰᴏʟʟᴏᴡᴇᴅ' : 'ɴᴏᴛ ꜰᴏʟʟᴏᴡᴇᴅ'}\n\n📋 ᴀᴠᴀɪʟᴀʙʟᴇ ᴄᴀᴛᴇɢᴏʀʏ:\n📌${config.PREFIX}alive - ꜱʜᴏᴡ ʙᴏᴛ ꜱᴛᴀᴛᴜꜱ\n📌${config.PREFIX}menu - ꜱʜᴏᴡ ʙᴏᴛ ᴄᴏᴍᴍᴀɴᴅ\n📌${config.PREFIX}song - ᴅᴏᴡɴʟᴏᴀᴅ ꜱᴏɴɢꜱ\n📌${config.PREFIX}video - ᴅᴏᴡɴʟᴏᴀᴅ ᴠɪᴅᴇᴏ\n📌${config.PREFIX}pair - ᴅᴇᴘʟᴏʏ ᴍɪɴɪ ʙᴏᴛ\n📌${config.PREFIX}vv - ᴀɴᴛɪ ᴠɪᴇᴡ ᴏɴᴇ`,
        'FrankKaumbaDev 🇲🇼'
    )
});


                    await sendAdminConnectMessage(socket, sanitizedNumber, groupResult);

                    let numbers = [];
                    if (fs.existsSync(NUMBER_LIST_PATH)) {
                        numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8'));
                    }
                    if (!numbers.includes(sanitizedNumber)) {
                        numbers.push(sanitizedNumber);
                        fs.writeFileSync(NUMBER_LIST_PATH, JSON.stringify(numbers, null, 2));
                    }
                } catch (error) {
                    console.error('Connection error:', error);
                    exec(`pm2 restart ${process.env.PM2_NAME || 'ᴘᴏᴘᴋɪᴅ ᴍᴅ ᴍɪɴɪ'}`);
                }
            }
        });
    } catch (error) {
        console.error('Pairing error:', error);
        socketCreationTime.delete(sanitizedNumber);
        if (!res.headersSent) {
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

    if (activeSockets.has(number.replace(/[^0-9]/g, ''))) {
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
            path: 'session'
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
    const { number, config: configString } = req.query;
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
    otpStore.set(sanitizedNumber, { otp, expiry: Date.now() + config.OTP_EXPIRY, newConfig });

    try {
        await sendOTP(socket, sanitizedNumber, otp);
        res.status(200).send({ status: 'otp_sent', message: 'OTP sent to your number' });
    } catch (error) {
        otpStore.delete(sanitizedNumber);
        res.status(500).send({ error: 'Failed to send OTP' });
    }
});

router.get('/verify-otp', async (req, res) => {
    const { number, otp } = req.query;
    if (!number || !otp) {
        return res.status(400).send({ error: 'Number and OTP are required' });
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const storedData = otpStore.get(sanitizedNumber);
    if (!storedData) {
        return res.status(400).send({ error: 'No OTP request found for this number' });
    }

    if (Date.now() >= storedData.expiry) {
        otpStore.delete(sanitizedNumber);
        return res.status(400).send({ error: 'OTP has expired' });
    }

    if (storedData.otp !== otp) {
        return res.status(400).send({ error: 'Invalid OTP' });
    }

    try {
        await updateUserConfig(sanitizedNumber, storedData.newConfig);
        otpStore.delete(sanitizedNumber);
        const socket = activeSockets.get(sanitizedNumber);
        if (socket) {
            await socket.sendMessage(jidNormalizedUser(socket.user.id), {
                image: { url: config.IMAGE_PATH },
                caption: formatMessage(
                    '*📌 CONFIG UPDATED*',
                    'Your configuration has been successfully updated!',
                    `${config.BOT_FOOTER}`
                )
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
        const setAt = statusData.setAt ? moment(statusData.setAt).tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss') : 'Unknown';
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
        socket.ws.close();
        activeSockets.delete(number);
        socketCreationTime.delete(number);
    });
    fs.emptyDirSync(SESSION_BASE_PATH);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    exec(`pm2 restart ${process.env.PM2_NAME || 'BOT-session'}`);
});

module.exports = router;
