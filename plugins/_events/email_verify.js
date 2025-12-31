export const run = {
   async: async (m, {
      client,
      body,
      users,
      hostJid,
      clientJid,
      findJid,
      Utils
   }) => {
      try {
         let user = hostJid ? global.db.users : findJid.bot(clientJid) ? findJid.bot(clientJid)?.data?.users : global.db.users
         if (!m.isGroup && body && body.length == 6 && /\d{6}/.test(body) && !users.verified) {
            if (users.jid == m.sender && users.code != body.trim()) return client.reply(m.chat, Utils.texted('bold', '❌ Your verification code is wrong.'), m)
            if (new Date - users.codeExpire > 180000) return client.reply(m.chat, Utils.texted('bold', '⚠ Your verification code has expired.'), m).then(() => {
               users.codeExpire = -1
               users.code = ''
               users.email = ''
               users.attempt = 0
            })
            return client.reply(m.chat, Utils.texted('bold', `✅ Your number has been successfully verified (+50 Limit)`), m).then(() => {
               users.codeExpire = -1
               users.code = ''
               users.attempt = 0
               users.verified = true
               users.limit += 50
               clearTimeout(client.verify[m.chat].timeout)
               delete client.verify[m.chat]
            })
         }
      } catch (e) {
         console.log(e)
         m.reply(Utils.jsonFormat(e))
      }
   },
   error: false,
   private: true
}