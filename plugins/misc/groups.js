import { format } from 'date-fns'
import { models } from '../../lib/system/models.js'

export const run = {
   usage: ['groups'],
   category: 'miscs',
   async: async (m, {
      client,
      isPrefix,
      hostJid,
      clientJid,
      findJid,
      system,
      Utils
   }) => {
      let group = hostJid ? global.db.groups : findJid.bot(clientJid) ? findJid.bot(clientJid)?.data?.groups : global.db.groups
      if (!group) group = []
      let isJoinedJid = []

      const participatingGroups = Object.values(await client.groupFetchAllParticipating())

      const groupDetails = participatingGroups.map((_group, i) => {
         const { id, subject, participants } = _group
         let entry = group.find(g => g.jid === id)
         isJoinedJid.push(id)

         if (entry) {
            const expiryStatus = entry.stay ? 'FOREVER' : (entry.expired == 0 ? 'NOT SET' : '' + Utils.timeReverse(entry.expired - new Date() * 1))
            const memberCount = participants.length
            const muteStatus = entry.mute ? 'OFF' : 'ON'
            const lastActivity = format(entry.activity, 'dd/MM/yy HH:mm:ss')

            if (!entry.member) {
               entry.member = {}
            }

            for (let member of client.lidParser(participants || [])) {
               if (!entry?.member?.[member.id]) {
                  entry.member[member.id] = {
                     ...models.member
                  }
               }
            }

            return (
               `›  *${i + 1}.* ${subject}\n` +
               `   *💳* : ${id.split('@')[0]}\n` +
               `   ${expiryStatus} | ${memberCount} | ${muteStatus} | ${lastActivity}`
            )
         } else {
            const newEntry = {
               jid: id,
               ...models.groups,
               name: subject
            }
            group.push(newEntry)

            return (
               `›  *${i + 1}.* ${subject}\n` +
               `   *💳* : ${id.split('@')[0]}\n` +
               `   *✅ NEW - Added to database, details will show on next run.*`
            )
         }
      }).join('\n\n')

      let caption = `乂  *G R O U P - L I S T*\n\n`
      caption += `*“Bot has joined ${participatingGroups.length} groups, send _${isPrefix}gc_ or _${isPrefix}gcopt_ to show all setup options.”*\n\n`
      caption += groupDetails
      caption += `\n\n${global.footer}`

      const updatedGroups = group.filter(g => isJoinedJid.includes(g.jid))

      if (hostJid) {
         global.db.groups = updatedGroups
      } else {
         const dataRef = findJid.bot(clientJid)
         if (dataRef?.data?.groups) {
            dataRef.data.groups = updatedGroups
         } else {
            global.db.groups = updatedGroups
         }
      }

      m.reply(caption).then(async () => {
         await system.database.save(global.db)
      })
   },
   cache: true,
   owner: true
}