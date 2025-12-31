export const run = {
   usage: ['transfer'],
   hidden: ['tf'],
   use: '@tag amount',
   category: 'user info',
   async: async (m, {
      client,
      args,
      isPrefix,
      command,
      hostJid,
      clientJid,
      findJid,
      Utils
   }) => {
      let users = hostJid ? global.db.users : findJid.bot(clientJid) ? findJid.bot(clientJid)?.data?.users : global.db.users
      if (m.quoted) {
         if (m.quoted.isBot) return client.reply(m.chat, Utils.texted('bold', `🚩 Cannot make transfers to bot.`), m)
         if (!args || !args[0]) return client.reply(m.chat, Utils.texted('bold', `🚩 Provide the nominal balance to be transferred.`), m)
         if (isNaN(args[0])) return client.reply(m.chat, Utils.texted('bold', `🚩 The balance must be a number.`), m)
         let nominal = parseInt(args[0])
         let ppn = parseInt(((25 / 100) * nominal).toFixed(0))
         let point = users.find(v => v.jid == m.sender).point
         let target = client.decodeJid(m.quoted.sender)
         if (target == m.sender) return client.reply(m.chat, Utils.texted('bold', `🚩 Unable to transfer to yourself.`), m)
         if (nominal > point) return client.reply(m.chat, Utils.texted('bold', `🚩 Your balance is not enough to make a transfer.`), m)
         if ((nominal + ppn) > point) return client.reply(m.chat, Utils.texted('bold', `🚩 Your balance is not enough to pay the transfer fee of 25%`), m)
         if (nominal < 10000) return client.reply(m.chat, Utils.texted('bold', `🚩 Nominal balance for transfer is at least 10K.`), m)
         users.find(v => v.jid == m.sender).point -= (nominal + ppn)
         users.find(v => v.jid == target).point += nominal
         let teks = `乂  *T R A N S F E R*\n\n`
         teks += `“Transfer successfully to *@${target.replace(/@.+/g, '')}*”\n\n`
         teks += `➠ *Nominal* : ${Utils.formatNumber(nominal)}\n`
         teks += `➠ *Fee* : ${Utils.formatNumber(ppn)} [25%]\n`
         teks += `➠ *Remaining Balance* : ${Utils.formatNumber(users.find(v => v.jid == m.sender).point)}`
         client.reply(m.chat, teks, m)
      } else if (m.mentionedJid.length != 0) {
         if (!args || !args[1]) return client.reply(m.chat, Utils.texted('bold', `🚩 Provide the nominal balance to be transferred.`), m)
         if (isNaN(args[1])) return client.reply(m.chat, Utils.texted('bold', `🚩 The balance must be a number.`), m)
         let nominal = parseInt(args[1])
         let ppn = parseInt(((25 / 100) * nominal).toFixed(0))
         let point = users.find(v => v.jid == m.sender).point
         let target = client.decodeJid(m.mentionedJid[0])
         if (target == client.decodeJid(client.user.id)) return client.reply(m.chat, Utils.texted('bold', `🚩 Cannot make transfers to bot.`), m)
         if (target == m.sender) return client.reply(m.chat, Utils.texted('bold', `🚩 Unable to transfer to yourself.`), m)
         if (nominal > point) return client.reply(m.chat, Utils.texted('bold', `🚩 Your balance is not enough to make a transfer.`), m)
         if ((nominal + ppn) > point) return client.reply(m.chat, Utils.texted('bold', `🚩 Your balance is not enough to pay the transfer fee of 25%`), m)
         if (nominal < 10000) return client.reply(m.chat, Utils.texted('bold', `🚩 Nominal balance for transfer is at least 10K.`), m)
         users.find(v => v.jid == m.sender).point -= (nominal + ppn)
         users.find(v => v.jid == target).point += nominal
         let teks = `乂  *T R A N S F E R*\n\n`
         teks += `“Transfer successfully to *@${target.replace(/@.+/g, '')}*”\n\n`
         teks += `➠ *Nominal* : ${Utils.formatNumber(nominal)}\n`
         teks += `➠ *Fee* : ${Utils.formatNumber(ppn)} [25%]\n`
         teks += `➠ *Remaining Balance* : ${Utils.formatNumber(users.find(v => v.jid == m.sender).point)}`
         client.reply(m.chat, teks, m)
      } else {
         let teks = `• *Example* :\n\n`
         teks += `${isPrefix + command} @0 10000\n`
         teks += `${isPrefix + command} 10000 (reply chat target)`
         client.reply(m.chat, teks, m)
      }
   },
   error: false,
   group: true
}