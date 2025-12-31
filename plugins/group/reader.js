import { format } from 'date-fns'

export const run = {
   usage: ['reader'],
   category: 'group',
   async: async (m, {
      client,
      ctx,
      Utils
   }) => {
      try {
         if (!m.quoted || (m.quoted && !m.quoted.fromMe)) return client.reply(m.chat, Utils.texted('bold', `🚩 Reply chat from BOT`), m)
         const msg = await ctx.store.loadMessage(m.chat, m.quoted.id)
         if (!msg) return client.reply(m.chat, Utils.texted('bold', `🚩 Message not found.`), m)
         let received = msg.userReceipt.filter(v => v.receiptTimestamp) || []
         let read = msg.userReceipt.filter(v => v.readTimestamp) || []
         if (received.length < 1 && read.length < 1) return client.reply(m.chat, Utils.texted('bold', `🚩 Data empty.`), m)
         const { participants } = await client.groupMetadata(m.chat)
         const toJid = id => participants?.find(v =>
            v.lid === id || v.id === id
         )?.phoneNumber || participants?.find(v =>
            v.lid === id || v.id === id
         )?.jid

         let text = ''
         if (received.length > 0) {
            text += `📍 Received : *${received.length}*\n`
            for (const v of received) {
               text += `┌ @${toJid(v.userJid).replace(/@.+/, '')}\n`
               text += `└ At : ${format(v.receiptTimestamp * 1000, 'EEEE, dd/MM HH:mm')}\n`
            }
         }
         if (read.length > 0) {
            text += '\n'
            text += `📍 Read By : *${read.length}*\n`
            for (const v of read) {
               text += `┌ @${toJid(v.userJid).replace(/@.+/, '')}\n`
               text += `└ At : ${format(v.readTimestamp * 1000, 'EEEE, dd/MM HH:mm')}\n`
            }
         }

         m.reply(text?.trim())

      } catch (e) {
         console.log(e)
         client.reply(m.chat, global.status.error, m)
      }
   },
   error: false,
   group: true
}