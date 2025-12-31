import { Utils, Scraper, Cooldown, Spam, Config, JID } from '@neoxr/wb'
const cooldown = new Cooldown(Config.cooldown)
const spam = new Spam({
   RESET_TIMER: Config.cooldown,
   HOLD_TIMER: Config.timeout,
   PERMANENT_THRESHOLD: Config.permanent_threshold,
   NOTIFY_THRESHOLD: Config.notify_threshold,
   BANNED_THRESHOLD: Config.banned_threshold
})
import { format } from 'date-fns'
import path from 'path'
import fs from 'node:fs'
import retry from 'async-retry'
import { session } from './lib/system/mapping.js'
import schema from './lib/system/schema.js'
import { terminal } from './core/controllers/socket-io.js'
import { injectMessageProxy } from './lib/system/injector.js'

// default is english choose *-en or *-id on .Config
const instruction = fs.readFileSync(path.join(process.cwd(), `media/greeting-${process.env.PROMPT_LANG}.txt`), 'utf-8')
import { Chatbot } from './lib/gemini.js'

export default async (client, ctx, child) => {
   let { store, m, body, prefix, plugins, commands, args, command, text, prefixes, core, schedule, market, system } = ctx
   const { hostJid, clientJid, findJid, bot } = JID(client)
   try {
      if (typeof m.sender === 'string' && m.sender?.endsWith('lid')) m.sender = client.getRealJid(m.sender) || m.sender
      const [groupMetadata, blockList] = await Promise.all([
         m.isGroup ? client.resolveGroupMetadata(m.chat) : Promise.resolve({}),
         client.fetchBlocklist().catch(() => [])
      ])

      schema(m, { hostJid, clientJid, findJid })

      const setup = global.db.setup
      let data = !hostJid && findJid.bot(clientJid) ? findJid.bot(clientJid).data : global.db

      const [_users, _chats, _groups, _players] = Utils.indexify([
         [data.users || [], 'jid'], [data.chats || [], 'jid'], [data.groups || [], 'jid'], [global.db.players || [], 'jid']
      ])

      const users = _users.get(m.sender) || {}
      const groupSet = _groups.get(m.chat) || {}
      const chats = _chats.get(m.chat) || {}
      const players = _players.get(m.sender) || {}
      const setting = data.setting
      const statistic = data.statistic
      const storage = data.storage
      const sticker = data.sticker

      const isOperator = [Config.owner, ...setup.operators].map(v => v + '@s.whatsapp.net').includes(m.sender)
      const isOwner = [clientJid.replace(/@.+/, ''), ...setting.owners].map(v => v + '@s.whatsapp.net').includes(m.sender) || isOperator
      const isModerator = setting.moderators?.map(v => v + '@s.whatsapp.net').includes(m.sender) || isOwner
      const isPrem = users && users.premium
      const participants = m.isGroup ? groupMetadata ? client.lidParser(groupMetadata.participants) : [] : [] || []
      const admins = m.isGroup ? client.getAdmin(participants) : []
      const isAdmin = m.isGroup ? admins.includes(m.sender) : false
      const isBotAdmin = m.isGroup ? admins.includes((client.user.id.split`:`[0]) + '@s.whatsapp.net') : false

      m = injectMessageProxy(m, client)

      const isSpam = spam.detection(client, m, {
         prefix, command, commands, users, cooldown,
         show: 'all', // options: 'all' | 'command-only' | 'message-only' | 'spam-only'| 'none'
         banned_times: users.ban_times,
         exception: isOwner || isOperator || isPrem
      })

      // exception disabled plugin
      plugins = Object.fromEntries(Object.entries(plugins).filter(([dir, _]) => !setting.pluginDisable.includes(path.basename(dir, '.js'))))

      // remove client bot
      if (m.isGroup && global.db.bots.length > 0) {
         let member = participants.map(v => client.decodeJid(v.id))
         let bot = global.db.bots.some(v => v.jid === client.decodeJid(m.sender))
         if (!m.fromMe && member.includes(Config.pairing.number + '@s.whatsapp.net') && member.includes(Config.owner + '@s.whatsapp.net') && bot) {
            if (isBotAdmin) return m.reply(Utils.texted('bold', `🚩 Client bots cannot be in the same group as the main bot.`)).then(async () => await client.groupParticipantsUpdate(m.chat, [m.sender], 'remove'))
            if (!isBotAdmin) return m.reply(Utils.texted('bold', `🚩 Client bots cannot be in the same group as the main bot.`))
         }
      }

      // terminal
      terminal(client.decodeJid(client.user.id), {
         isCmd: commands.includes(command),
         at: format(Date.now(), 'dd/MM/yy'),
         type: m.mtype,
         size: Utils.formatSize(Number(m?.msg?.fileLength?.low || m?.msg?.fileLength || 0)),
         from: m.sender?.replace(/@.+/, ''),
         self: m.fromMe,
         in: m.chat?.replace(/@.+/, ''),
         in_name: m.isGroup ? groupMetadata.subject : '',
         body: m.text || '-'
      })

      // file traffic
      if (m.fromMe && /audio|video|sticker|image|document/gis.test(m.mtype)) setting.outbound += Number(m?.msg?.fileLength?.low || m?.msg?.fileLength || 0)
      if (!m.fromMe && /audio|video|sticker|image|document/gis.test(m.mtype)) setting.inbound += Number(m?.msg?.fileLength?.low || m?.msg?.fileLength || 0)

      // message counting
      if (m.fromMe) setting.sent += 1
      else setting.received += 1

      // response limit
      if (!hostJid) {
         const now = Date.now()
         const fn = findJid.bot(clientJid)
         if (!fn) return

         if (typeof fn.plan === 'undefined' || typeof fn.limit === 'undefined') {
            const plan = Config.bot_hosting.price_list.find(v => v.code === 'trial')
            if (plan) {
               fn.plan = plan.code
               fn.limit = plan.response
               fn.expired = now + (plan.days * 24 * 60 * 60 * 1000)
            } else {
               fn.plan = 'none'
               fn.limit = 0
               fn.expired = now
            }
         }

         if (fn.plan !== 'none') {
            if (fn.expired && now > fn.expired) return
            if (m.isBot && m.fromMe) {
               if (fn.limit > 0) {
                  fn.limit -= 1
               } else return
            } else {
               if (fn.limit < 1) return
            }
         }
      }

      // webhook
      if (!/status|g.us/.test(m.chat)) client.webhook(setting, m)

      if (!setting.online) client.sendPresenceUpdate('unavailable', m.chat)
      if (setting.online) {
         client.sendPresenceUpdate('available', m.chat)
         client.readMessages([m.key])
      }
      if (!m.isGroup && m.fromMe && !m.isBot && chats) chats.lastreply = new Date() * 1
      if (m.isGroup && groupSet) {
         groupSet.name = groupMetadata.subject ?? ''
         groupSet.activity = new Date() * 1
         for (let jid of Object.keys(groupSet.member)) {
            if (groupSet.member[jid]?.left === true || !jid.endsWith('.net')) {
               delete groupSet.member[jid]
            }
         }
      }
      if (users) {
         if (!users.lid) {
            const { lid } = await client.getUserId(m.sender)
            if (lid) users.lid = lid
         }
         users.name = m.pushName
         users.lastseen = new Date() * 1
         if (users.rpg && !Object.keys(players).length) {
            users.rpg = false
         }
      }
      const validLids = new Set(data.users.map(item => item.lid).filter(lid => lid !== null))
      data.users = data.users.filter(item => {
         if (item.lid !== null) return true
         return !validLids.has(item.jid)
      })
      if (players) {
         players.name = m.pushName
      }
      if (chats) {
         chats.chat += 1
         chats.lastseen = new Date * 1
      }
      if (!setting.multiprefix) setting.noprefix = false
      if (setting.debug && !m.fromMe && isOwner) client.reply(m.chat, Utils.jsonFormat(m), m)
      if (!m.fromMe && m.isGroup && groupSet.antibot && !isOwner && isBotAdmin) {
         if (m.isBot || ['interactiveMessage', 'buttonsMessage'].includes(m.mtype)) return m.reply(Utils.texted('italic', `⚠ Other bot are not allowed in this group.`)).then(async () => {
            await Utils.delay(1200)
            client.groupParticipantsUpdate(m.chat, [m.sender], 'remove')
         })
      }
      if (m.isGroup && !m.isBot && groupSet?.member[m.sender]?.afk > -1) {
         let member = groupSet.member[m.sender]
         client.reply(m.chat, `You are back online after being offline for : ${Utils.texted('bold', Utils.toTime(new Date - member.afk))}\n\n• ${Utils.texted('bold', 'Reason')}: ${member?.afkReason || '-'}`, m)
         member.afk = -1
         member.afkReason = ''
         member.afkObj = {}
      }
      if (m.isGroup && !m.fromMe) {
         let now = new Date() * 1
         if (!groupSet.member[m.sender]) {
            groupSet.member[m.sender] = {
               chat: 1,
               lastseen: now,
               warning: 0
            }
         } else {
            (!groupSet.member[m.sender].chat) ? groupSet.member[m.sender].chat = 1 : groupSet.member[m.sender].chat += 1
            groupSet.member[m.sender].lastseen = now
         }
      }

      // anti spam media (sticker, video & image)
      if (m.isGroup && groupSet.restrict && isBotAdmin && /video|image|sticker/.test(m.mtype) && isSpam && /(BANNED|NOTIFY|TEMPORARY)/.test(isSpam.state)) return client.groupParticipantsUpdate(m.chat, [m.sender], 'remove')
      if (body && !setting.self && core.prefix != setting.onlyprefix && commands.includes(core.command) && !setting.multiprefix && !Config.evaluate_chars.includes(core.command)) return client.reply(m.chat, `🚩 *Incorrect prefix!*, this bot uses prefix : *[ ${setting.onlyprefix} ]*\n\n➠ ${setting.onlyprefix + core.command} ${text || ''}`, m)
      const matcher = Utils.matcher(command, commands).filter(v => v.accuracy >= 60)
      if (prefix && !commands.includes(command) && matcher.length > 0 && !setting.self) {
         if (!m.isGroup || (m.isGroup && !groupSet.mute)) return client.reply(m.chat, `🚩 Command you are using is wrong, try the following recommendations :\n\n${matcher.map(v => '➠ *' + (prefix ? prefix : '') + v.string + '* (' + v.accuracy + '%)').join('\n')}`, m).then(() => {
            if (text && Utils.hasRestrictedLinks(text) && m.isGroup && groupSet.antilink && isBotAdmin) return client.sendMessage(m.chat, {
               delete: {
                  remoteJid: m.chat,
                  fromMe: false,
                  id: m.key.id,
                  participant: m.sender
               }
            }).then(() => client.groupParticipantsUpdate(m.chat, [m.sender], 'remove'))
         })
      }

      const trigger = body && prefix && commands.includes(command)
         || body && !prefix && commands.includes(command) && setting.noprefix
         || body && !prefix && commands.includes(command) && Config.evaluate_chars.includes(command)

      if (trigger) {
         if (setting.error.includes(command)) return client.reply(m.chat, Utils.texted('bold', `🚩 Command _${(prefix ? prefix : '') + command}_ disabled.`), m)
         if (!m.isGroup && Config.blocks.some(no => m.sender?.startsWith(no))) return client.updateBlockStatus(m.sender, 'block')
         if (commands.includes(command)) {
            users.hit += 1
            users.usebot = new Date() * 1
            Utils.hitstat(command, m.sender, {
               hostJid, clientJid, findJid
            })
         }
         const is_commands = Object.fromEntries(Object.entries(plugins).filter(([name, prop]) => prop.run.usage))
         for (const [pluginPath, pluginData] of Object.entries(is_commands)) {
            const name = path.basename(pluginPath, '.js')
            const cmd = pluginData.run
            const turn = cmd.usage instanceof Array ? cmd.usage.includes(command) : cmd.usage instanceof String ? cmd.usage == command : false
            const turn_hidden = cmd.hidden instanceof Array ? cmd.hidden.includes(command) : cmd.hidden instanceof String ? cmd.hidden == command : false
            if (!turn && !turn_hidden) continue
            if ((m.fromMe && m.isBot) || /broadcast|newsletter/.test(m.chat)) continue
            if (setting.self && !isOwner && !m.fromMe) continue
            const exception = ['owner', 'menfess', 'verify', 'payment', 'premium', 'buyprem', 'sewa', 'exec', 'suit-ans']
            if (m.isGroup && groupSet && groupSet.adminonly && !isAdmin && !exception.includes(name)) continue
            if (!m.isGroup && !exception.includes(name) && chats && !isPrem && !isOwner && !users.banned && setting.groupmode) {
               client.autoai = client?.autoai || []
               let session = client.autoai?.find(v => v.jid === m.sender)
               if (!session) {
                  client.autoai.push({
                     jid: m.sender,
                     history: []
                  })
                  session = client.autoai.find(v => v.jid === m.sender)
               }

               try {
                  if (body && typeof body === 'string') {
                     const response = await retry(async () => {
                        const json = await Chatbot(body, null, session?.history || [], instruction + setting.link)
                        if (!json.status) {
                           client.autoai = []
                           throw new Error(json.msg)
                        }
                        return json
                     }, {
                        retries: 3,
                        minTimeout: 1000,
                        maxTimeout: 3000,
                        onRetry: (e, n) => { }
                     })
                     if (!response.status) throw new Error(response.msg)
                     return client.sendFromAI(m.chat, response.data.message, m).then(async () => {
                        session.history = response.data.history
                     })
                  }
               } catch (e) {
                  return m.reply(e.message)
               }
               continue
            }

            if (m.isGroup && !isAdmin && isBotAdmin && groupSet.antilink && !['join'].includes(name)) {
               if (text && Utils.hasRestrictedLinks(text)) return client.sendMessage(m.chat, {
                  delete: {
                     remoteJid: m.chat,
                     fromMe: false,
                     id: m.key.id,
                     participant: m.sender
                  }
               }).then(() => client.groupParticipantsUpdate(m.chat, [m.sender], 'remove'))
            }

            // Email Verification
            const isShouldVerify = !exception.includes(name) && !m.isGroup && !users?.banned && !users?.verified && setting?.verify && !isOwner
            let note = `⚠️ *[ ${users.attempt} / 5 ]* Verifikasi nomor dengan menggunakan email, 1 email untuk memverifikasi 1 nomor WhatsApp. Silahkan ikuti step by step berikut :\n\n`
            note += `– *STEP 1*\nGunakan perintah *${prefix ? prefix : ''}reg <email>* untuk mendapatkan kode verifikasi melalui email.\nContoh : *${prefix ? prefix : ''}reg neoxrbot@gmail.com*\n\n`
            note += `– *STEP 2*\nBuka email dan cek pesan masuk atau di folder spam, setelah kamu mendapat kode verifikasi silahkan kirim kode tersebut kepada bot.\n\n`
            note += `*Note* :\nMengabaikan pesan ini sebanyak *5x* kamu akan di banned dan di blokir, untuk membuka banned dan blokir dikenai biaya sebesar Rp. 10,000`
            if (isShouldVerify && users?.attempt >= 5) {
               client.reply(m.isGroup ? m.sender : m.chat, Utils.texted('bold', `🚩 [ ${users.attempt} / 5 ] : Kamu mengabaikan pesan verifikasi tapi tenang masih ada bot lain kok, banned thanks. (^_^)`), m).then(() => {
                  users.banned = true
                  users.attempt = 0
                  users.code = ''
                  users.codeExpire = 0
                  users.email = ''
                  client.updateBlockStatus(m.sender, 'block')
               })
               continue
            } else if (isShouldVerify) {
               users.attempt += 1
               client.sendMessageModify(m.chat, note, m, {
                  largeThumb: true,
                  thumbnail: 'https://telegra.ph/file/31601aee3fdf941bebbc4.jpg'
               })
               continue
            }

            if (!['me', 'owner', 'exec'].includes(name) && users && (users.banned || new Date - users.ban_temporary < Config.timeout)) continue
            if (m.isGroup && !['activation', 'groupinfo'].includes(name) && groupSet.mute) continue
            if (cmd.operator && !isOperator) {
               client.reply(m.chat, global.status.operator, m)
               continue
            }
            if (cmd.owner && !isOwner) {
               client.reply(m.chat, global.status.owner, m)
               continue
            }
            if (cmd.moderator && !isModerator) {
               client.reply(m.chat, global.status.moderator, m)
               continue
            }
            if (setting.antispam && isSpam && /(BANNED|NOTIFY|TEMPORARY)/.test(isSpam.state)) {
               client.reply(m.chat, Utils.texted('bold', `🚩 ${isSpam.msg}`), m)
               continue
            }
            if (setting.antispam && isSpam && /HOLD/.test(isSpam.state)) continue
            if (cmd.restrict && !isPrem && !isOwner && !isOperator && text && new RegExp('\\b' + setting.toxic.join('\\b|\\b') + '\\b').test(text.toLowerCase())) {
               client.reply(m.chat, `⚠️ You violated the *Terms & Conditions* of using bots by using blacklisted keywords, as a penalty for your violation being blocked and banned.`, m).then(() => {
                  users.banned = true
                  client.updateBlockStatus(m.sender, 'block')
               })
               continue
            }
            if (cmd.premium && !isPrem) {
               client.reply(m.chat, global.status.premium, m)
               continue
            }
            if (cmd.limit && !cmd.game && users.limit < 1) {
               const msg = `⚠️ You reached the limit and will be reset at 00.00\n\nTo get more limits upgrade to premium plans.`
               m.reply(msg).then(() => users.premium = false)
               continue
            }
            if (cmd.limit && !cmd.game && users.limit > 0) {
               const limit = cmd.limit.constructor.name == 'Boolean' ? 1 : cmd.limit
               if (users.limit >= limit) {
                  users.limit -= limit
               } else {
                  client.reply(m.chat, Utils.texted('bold', `⚠️ Your limit is not enough to use this feature.`), m)
                  continue
               }
            }
            if (cmd.limit && cmd.game && users.limit_game < 1) {
               client.reply(m.chat, `⚠️ You reached the game limit and will be reset at 00.00\n\nTo get more limits upgrade to premium plan.`, m)
               continue
            }
            if (cmd.limit && cmd.game && users.limit_game > 0) {
               const limit = cmd.limit.constructor.name == 'Boolean' ? 1 : cmd.limit
               if (users.limit_game >= limit) {
                  users.limit_game -= limit
               } else {
                  client.reply(m.chat, Utils.texted('bold', `⚠️ Your game limit is not enough to play this game.`), m)
                  continue
               }
            }
            if (cmd.group && !m.isGroup) {
               client.reply(m.chat, global.status.group, m)
               continue
            } else if (cmd.botAdmin && !isBotAdmin) {
               client.reply(m.chat, global.status.botAdmin, m)
               continue
            } else if (cmd.admin && !isAdmin) {
               client.reply(m.chat, global.status.admin, m)
               continue
            }
            if (cmd.private && m.isGroup) {
               client.reply(m.chat, global.status.private, m)
               continue
            }
            if (cmd.game && !setting.games) {
               client.reply(m.chat, global.status.gameSystem, m)
               continue
            }
            if (cmd.game && Utils.level(users.point, Config.multiplier)[0] >= 50) {
               client.reply(m.chat, global.status.gameLevel, m)
               continue
            }
            if (cmd.game && m.isGroup && !groupSet.game) {
               client.reply(m.chat, global.status.gameInGroup, m)
               continue
            }
            if (cmd.game && m.isGroup && !groupSet.game) {
               client.reply(m.chat, global.status.gameInGroup, m)
               continue
            }
            if (cmd.category === 'rpg' && !['rpg'].includes(name) && !users?.rpg) {
               client.reply(m.chat, `⚠️ This command requires user confirmation. Inactive players for 3 days will have their data deleted.\n\nSend *${prefix}rpg -y* to confirm.`, m)
               continue
            }
            if (cmd.category === 'rpg' && users.rpg) {
               players.lastseen = Date.now()
            }
            cmd.async(m, { client, args, text, isPrefix: prefix, prefixes, command, groupMetadata, participants, users, chats, groupSet, players, setting, statistic, storage, sticker, setup, hostJid, clientJid, findJid, bot, isOperator, isOwner, isModerator, isAdmin, isBotAdmin, isPrem, plugins, blockList, Config, ctx, store, system, schedule, market, child, Utils, Scraper })
            break
         }
      } else {
         const is_events = Object.fromEntries(Object.entries(plugins).filter(([name, prop]) => !prop.run.usage && !prop.run.hidden))
         for (const [pluginPath, pluginData] of Object.entries(is_events)) {
            const name = path.basename(pluginPath, '.js')
            const event = pluginData.run
            if ((m.fromMe && m.isBot) || /broadcast|newsletter/.test(m.chat)) continue
            if (!m.isGroup && Config.blocks.some(no => m.sender.startsWith(no))) return client.updateBlockStatus(m.sender, 'block')
            const protector = ['anti_link', 'anti_tagall', 'anti_virtex', 'anti_tagsw', 'anti_porn', 'filter']
            if (m.isGroup && groupSet && groupSet.adminonly && !isAdmin && !protector.includes(name)) continue
            if (setting.self && !['menfess_ev', ...protector].includes(event.pluginName) && !isOwner && !m.fromMe) continue
            if (!protector.includes(name) && users && (users.banned || new Date - users.ban_temporary < Config.timeout)) continue
            if (!protector.includes(name) && groupSet && groupSet.mute) continue
            const exception = ['system_ev', 'menfess_ev', 'anonymous-chat_ev', 'chatbot_ev', 'auto_download', 'dial_ev', 'ev_petbattle', 'verify_email']
            let isJoin = false
            if (client?.petbattle) {
               for (const x of Object.values(client.petbattle)) {
                  if (x.players?.map(v => v.jid)?.includes(m.sender)) {
                     isJoin = true
                     break
                  }
               }
            }
            const isSkip = setting?.menfess?.find(v => v.from === m.sender)?.state || setting?.menfess?.find(v => v.receiver === m.sender)?.state
            if (!m.isGroup && (client?.verify?.[m.sender] && setting.verify) && !['email_verify'].includes(name)) continue
            if (!m.isGroup && setting.groupmode && client?.verify?.[m.sender] && (!isSkip || !isJoin) && !exception.includes(name)) {
               client.autoai = client?.autoai || []
               let session = client.autoai?.find(v => v.jid === m.sender)
               if (!session) {
                  client.autoai.push({
                     jid: m.sender,
                     history: []
                  })
                  session = client.autoai.find(v => v.jid === m.sender)
               }
               try {
                  if (body && typeof body === 'string') {
                     const response = await retry(async () => {
                        const json = await Chatbot(body, null, session?.history || [], instruction + setting.link)
                        if (!json.status) {
                           client.autoai = []
                           throw new Error(json.msg)
                        }
                        return json
                     }, {
                        retries: 3,
                        minTimeout: 1000,
                        maxTimeout: 3000,
                        onRetry: (e, n) => { }
                     })
                     if (!response.status) throw new Error(response.msg)
                     return client.sendFromAI(m.chat, response.data.message, m).then(async () => {
                        session.history = response.data.history
                     })
                  }
               } catch (e) {
                  return m.reply(e.message)
               }
               continue
            }
            if (['chatbot_ev'].includes(name) && chats && (new Date - chats.lastreply < Config.timer)) continue
            if (event.error) continue
            if (session.has(m.sender) && ['chatbot_ev', 'dial_ev', 'response_ev', 'storage_ev'].includes(name)) continue
            if (event.operator && !isOperator) continue
            if (event.owner && !isOwner) continue
            if (event.moderator && !isModerator) continue
            if (event.group && !m.isGroup) continue
            if (!event.game && event.limit && users.limit < 1 && body && Utils.generateLink(body) && Utils.generateLink(body).some(v => Utils.socmed(v))) return m.reply(`⚠️ You reached the limit and will be reset at 00.00\n\nTo get more limits upgrade to premium plans.`).then(() => {
               users.premium = false
               users.expired = 0
            })
            if (event.game && event.limit && users.limit_game < 1 && body) return client.reply(m.chat, `⚠️ You reached the game limit and will be reset at 00.00\n\nTo get more limits upgrade to premium plan or buy it with points use *${prefixes[0]}buygl* command.`, m)
            if (event.botAdmin && !isBotAdmin) continue
            if (event.admin && !isAdmin) continue
            if (event.private && m.isGroup) continue
            if (event.download && body && !setting.autodownload) continue
            if (event.download && body && setting.autodownload) {
               if (!body || (body && !Utils.generateLink(body) || !Utils.generateLink(body)?.some(v => Utils.socmed(v)))) continue
               if (!isPrem && Utils.generateLink(body)?.some(v => Utils.socmed(v))) return client.sendMessage(m.chat, {
                  delete: {
                     remoteJid: m.chat,
                     fromMe: isBotAdmin ? false : true,
                     id: m.id,
                     participant: m.sender
                  }
               }).then(() => {
                  m.reply(`⚠️ Auto download is only for premium users, use command to download️.`)
               })
            }
            if (event.game && !setting.games) continue
            if (event.game && Utils.level(users.point, Config.multiplier)[0] >= 50) continue
            if (event.game && m.isGroup && !groupSet.game) continue
            event.async(m, { client, body, prefixes, groupMetadata, participants, users, chats, groupSet, players, setting, statistic, storage, sticker, setup, hostJid, clientJid, findJid, bot, isOperator, isOwner, isModerator, isAdmin, isBotAdmin, isPrem, plugins, blockList, Config, ctx, store, system, schedule, market, child, Utils, Scraper })
         }
      }
   } catch (e) {
      if (/(rate|overlimit|timeout|users)/ig.test(e.message)) return
      console.log(e)
      // if (!m.fromMe) return m.reply(Utils.jsonFormat(new Error('neoxr-bot encountered an error :' + e)))
   }
}