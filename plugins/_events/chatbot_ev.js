import { Utils as utils } from '@neoxr/wb'
import { watermark } from '../../lib/canvas.js'
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs'
import bytes from 'bytes'
import { Utils as Helper, Chatbot } from '../../lib/gemini.js'

// default is english choose *-en or *-id
const instruction = fs.readFileSync(
   path.join(process.cwd(), `media/prompt-${process.env.PROMPT_LANG}.txt`),
   'utf-8'
)

export const run = {
   async: async (m, {
      client,
      body,
      users,
      setting,
      Config
   }) => {
      try {
         global.db.autoai = global.db.autoai ? global.db.autoai : []
         var session = global.db.autoai.find(v => v.jid === m.sender)
         if (!session) {
            global.db.autoai.push({
               jid: m.sender,
               history: []
            })
            var session = global.db.autoai.find(v => v.jid === m.sender)
         }

         const inAnonChat = global.db?.anon?.chats?.find(c => c.a === m.sender || c.b === m.sender)
         const isInMenfess = setting?.menfess?.find(v => v.from === m.sender || v.receiver === m.sender)?.state

         if (m.sender != client.decodeJid(client.user.id) && !setting.except.includes(m.sender.replace(/@.+/, '')) && /conversation|extended|video|image|audio|document/.test(m.mtype) && !utils.socmed(body) && !client?.verify?.[m.sender] && !inAnonChat && !isInMenfess) {
            if (setting.chatbot && !Config.evaluate_chars.some(v => body.startsWith(v))) {
               const notice = '🚩 Your limit is not enough to use this feature.'
               const q = m.quoted ? m.quoted : m
               const mime = (q.msg || q).mimetype
               const max_size = '5MB'
               const instanceBody = (m.quoted ? (body && typeof body === 'string' ? body : '') + ' ' + m.quoted?.text : body)?.trim()
               const isBody = instanceBody.replace(new RegExp(`@${client.decodeJid(client.user.id).replace(/@.+/g, '')}`, 'g'), '')

               let isTag = false
               for (const jid of [...new Set([...(m.mentionedJid || [])])]) {
                  if (jid === client.decodeJid(client.user.id) || jid === client.decodeJid(client.user.lid)) {
                     isTag = true
                     break
                  }
               }

               let isAI = m?.quoted?.id && /AI-/i.test(m?.quoted?.id) || false

               switch (true) {
                  // video & image (jpg/png)
                  case /video|image\/(jpe?g|png)/.test(mime): {
                     if ((m.isGroup && (isTag || isAI)) || (!m.isGroup && !isTag)) {
                        if (isBody && typeof isBody === 'string') {
                           if (users.limit < 1) return client.reply(m.chat, utils.texted('bold', notice), m)
                           if ((q.msg || q).fileLength.low >= bytes(max_size)) return client.reply(m.chat, utils.texted('bold', `🚩 Maximum media size is ${max_size}.`), m)

                           client.reply(m.chat, 'Analyzing ...', m)

                           const buffer = await q.download()
                           const cdn = await Helper.upload(buffer)
                           if (!cdn.status) return

                           const json = await Chatbot(isBody, cdn.data.url, session.history || [], instruction)
                           if (!json.status) return client.reply(m.chat, utils.texted('bold', `❌ ${json.msg}`), m)

                           const chat = await Helper.logic(json.data.message)
                           if (!chat.status) return client.reply(m.chat, utils.texted('bold', `❌ ${chat.msg}`), m)
                           await wrapper(m, { client, metadata: chat.data, session, users, history: json.data.history, params: { url: cdn.data.url } })
                        }
                     }
                  }
                     break

                  // audio
                  case /audio/.test(mime): {
                     if ((m.isGroup && (isTag || isAI)) || (!m.isGroup && !isTag)) {
                        if (users.limit < 1) return client.reply(m.chat, utils.texted('bold', notice), m)
                        if ((q.msg || q).fileLength.low >= bytes(max_size)) return client.reply(m.chat, utils.texted('bold', `🚩 Maximum media size is 5 MB.`), m)

                        client.reply(m.chat, 'Analyzing ...', m)

                        const buffer = await q.download()
                        const cdn = await Helper.upload(buffer)
                        if (!cdn.status) return

                        const json = await Chatbot(isBody, cdn.data.url, session.history || [], instruction)
                        if (!json.status) return client.reply(m.chat, utils.texted('bold', `❌ ${json.msg}`), m)

                        const chat = await Helper.logic(json.data.message)
                        if (!chat.status) return client.reply(m.chat, utils.texted('bold', `❌ ${chat.msg}`), m)
                        await wrapper(m, { client, metadata: chat.data, session, users, history: json.data.history })
                     }
                  }
                     break

                  // document
                  case /document/.test(q.mtype): {
                     if ((m.isGroup && (isTag || isAI)) || (!m.isGroup && !isTag)) {
                        if (isBody && typeof isBody === 'string') {
                           if (users.limit < 1) return client.reply(m.chat, utils.texted('bold', notice), m)
                           if ((q.msg || q).fileLength.low >= bytes(max_size)) return client.reply(m.chat, utils.texted('bold', `🚩 Maximum media size is 5 MB.`), m)

                           client.reply(m.chat, 'Analyzing ...', m)

                           const buffer = await q.download()
                           const cdn = await Helper.upload(buffer)
                           if (!cdn.status) return

                           const json = await Chatbot(isBody, cdn.data.url, session.history || [], instruction)
                           if (!json.status) return client.reply(m.chat, utils.texted('bold', `❌ ${json.msg}`), m)

                           const chat = await Helper.logic(json.data.message)
                           if (!chat.status) return client.reply(m.chat, utils.texted('bold', `❌ ${chat.msg}`), m)
                           await wrapper(m, { client, metadata: chat.data, session, users, history: json.data.history })
                        }
                     }
                  }
                     break

                  // text
                  default: {
                     if (/conversation|extended/.test(m.mtype) && isBody && typeof isBody === 'string' && ((m.isGroup && (isTag || isAI)) || (!m.isGroup && !isTag))) {
                        if (users.limit < 1) return client.reply(m.chat, utils.texted('bold', notice), m)

                        const json = await Chatbot(isBody, null, session.history || [], instruction)
                        if (!json.status) return client.reply(m.chat, utils.texted('bold', `❌ ${json.msg}`), m)

                        const chat = await Helper.logic(json.data.message)
                        if (!chat.status) return client.reply(m.chat, utils.texted('bold', `❌ ${chat.msg}`), m)
                        await wrapper(m, { client, metadata: chat.data, session, users, history: json.data.history })
                     }
                  }
               }
            }
         }
      } catch (e) {
         console.log(e)
         // client.reply(m.chat, utils.jsonFormat(e), m)
      }
   },
   error: false
}

const wrapper = (m, { client, metadata, session, users, history, params = {} }) => new Promise(async resolve => {
   try {
      const { context, command, argument, message } = metadata
      const sendMethod = m.isGroup ? client.reply : client.sendFromAI
      if (context === 'NONE') return sendMethod(m.chat, message, m, { isAI: true }).then(() => {
         session.history = history
         users.limit -= 1
      })
      if (context === 'EMOTION') return sendMethod(m.chat, message, m, { isAI: true }).then(async () => {
         const { sk_pack, sk_author } = global.db?.setting
         const buffer = await utils.fetchAsBuffer(`./media/sticker/${command.replace('stc_', '')}.webp`)
         await client.sendSticker(m.chat, buffer, null, {
            packname: sk_pack || '',
            author: sk_author || ''
         })
         session.history = history
         users.limit -= 1
      })
      if (context === 'REQUEST') {
         switch (command) {
            case 'cmd_play': {
               if (message) m.reply(message)
               const json = await Api.neoxr('/play', { q: argument })
               if (!json.status) throw new Error(json.msg)
               client.sendFile(m.chat, json.data.url, json.data.filename, '', m, {
                  APIC: await utils.fetchAsBuffer(json.thumbnail),
                  isAI: true
               })
               break
            }

            case 'cmd_genimg': {
               if (message) m.reply(message)
               const json = await Api.neoxr('/bardimg', { q: argument })
               if (!json.status) throw new Error(json.msg)
               if (!users.premium) {
                  const buffer = await utils.fetchAsBuffer(json.data.url)
                  const output = await watermark(buffer, fs.readFileSync('./media/image/watermark.png'))
                  client.sendFile(m.chat, output.buffer, '', '', m, { isAI: true })
               } else {
                  client.sendFile(m.chat, json.data.url, '', '', m, { isAI: true })
               }
            }
               break

            case 'cmd_edit': {
               if (!params?.url) return m.reply('Please provide an image.')
               if (message) m.reply(message)
               const json = await Api.neoxr('/photo-editor', {
                  image: params?.url,
                  q: argument
               })
               if (!json.status) throw new Error(json.msg)
               if (!users.premium) {
                  const buffer = await utils.fetchAsBuffer(json.data.url)
                  const output = await watermark(buffer, fs.readFileSync('./media/image/watermark.png'))
                  client.sendFile(m.chat, output.buffer, '', '', m, { isAI: true })
               } else {
                  client.sendFile(m.chat, json.data.url, '', '', m, { isAI: true })
               }
            }
               break

            case 'cmd_pin': {
               if (message) m.reply(message)
               const json = await Api.neoxr('/pinterest', { q: argument })
               if (!json.status) throw new Error(json.msg)
               const imgUrl = utils.random(json.data)
               client.sendFile(m.chat, imgUrl, '', '', m, { isAI: true })
            }
               break

            case 'cmd_pinimg':
            case 'cmd_pinvid': {
               if (message) m.reply(message)
               const shuffleArray = array => {
                  const shuffledArray = [...array]
                  for (let i = shuffledArray.length - 1; i > 0; i--) {
                     const randomIndex = Math.floor(Math.random() * (i + 1))
                     const temp = shuffledArray[i]
                     shuffledArray[i] = shuffledArray[randomIndex]
                     shuffledArray[randomIndex] = temp
                  }
                  return shuffledArray
               }
               const json = await Api.neoxr('/pinterest-v2', {
                  q: argument,
                  show: 20,
                  type: command === 'cmd_pinimg' ? 'image' : 'video'
               })
               if (!json.status) throw new Error(json.msg)
               const result = shuffleArray(json.data).splice(0, 1)
               if (command === 'cmd_pinimg') {
                  for (const v of result) {
                     client.sendFile(m.chat, v.content[0].url, '', '', m, { isAI: true })
                  }
               } else if (command === 'cmd_pinvid') {
                  for (const v of result) {
                     if (/jpg|gif/.test(v.content[0].url)) continue

                     if (/m3u8/.test(v.content[0].url)) {
                        const output = './temp/' + utils.filename('mp4')
                        ffmpeg(v.content[0].url)
                           .on("error", error => {
                              m.reply(utils.texted('bold', `🚩 Conversion failed!`))
                           })
                           .on("end", async () => {
                              client.sendFile(m.chat, output, '', '', m)
                           })
                           .outputOptions("-c copy")
                           .outputOptions("-bsf:a aac_adtstoasc")
                           .output(output)
                           .run()
                     } else {
                        client.sendFile(m.chat, v.content[0].url, '', '', m, { isAI: true })
                     }
                  }
               }
               break
            }
            default: {
               client.reply(m.chat, message, m, { isAI: true })
            }
         }
      }
   } catch (e) {
      console.log(e)
      m.reply(e.message)
   }
})