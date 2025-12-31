export const run = {
   async: async (m, {
      client,
      hostJid,
      clientJid,
      findJid,
      Config,
      Utils
   }) => {
      try {
         let database
         if (hostJid) {
            database = global.db
         } else if (findJid.bot(clientJid)) {
            database = findJid.bot(clientJid).data
         } else {
            database = global.db
         }

         const INACTIVE_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000 // 3 days
         const PROVED_THRESHOLD_MS = 1.5 * 60 * 1000 // 1.5 minutes
         const now = Date.now()

         if (database.users) {
            database.users = database.users.filter(user => {
               const isRecent = (now - user.lastseen) <= INACTIVE_THRESHOLD_MS
               const isProtected = user.premium || user.banned || user.point >= 1000000
               return isRecent || isProtected
            })
         }

         if (database.chats) {
            database.chats = database.chats.filter(chat => (now - chat.lastseen) <= INACTIVE_THRESHOLD_MS)
         }

         if (database.groups) {
            database.groups = database.groups.filter(group => (now - group.activity) <= INACTIVE_THRESHOLD_MS)
         }

         if (global.db.instance) {
            const pairingJid = `${Config.pairing.number}@s.whatsapp.net`
            const registeredBots = global.db.bots?.map(v => v.jid) ?? []
            global.db.instance = global.db.instance.filter(
               inst => inst.jid === pairingJid || registeredBots.includes(inst.jid)
            )
         }

         if (global.db.players) {
            const inactivePlayers = global.db.players.filter(player =>
               player.lastseen && (now - player.lastseen) > INACTIVE_THRESHOLD_MS
            )

            if (inactivePlayers.length > 0) {
               inactivePlayers.forEach(player => {
                  const userIndex = database.users.findIndex(u => u.jid === player.jid)

                  if (userIndex !== -1) {
                     database.users[userIndex].rpg = false
                  } else { }
               })
            }

            global.db.players = global.db.players.filter(player =>
               player.lastseen && (now - player.lastseen) <= INACTIVE_THRESHOLD_MS
            )
         }

         // if (global.db.bots) {
         //    const now = Date.now()

         //    global.db.bots = global.db.bots.filter(bot => {
         //       if (bot.stop || bot.is_logout || bot.is_connected) return true
         //       return (now - bot.last_connect) <= PROVED_THRESHOLD_MS
         //    })
         // }
      } catch (e) {
         console.error(e)
         client.reply(m.chat, Utils.jsonFormat(e), m)
      }
   },
   error: false
}