import { Utils } from '@neoxr/wb'

export const routes = {
   category: 'action',
   path: '/action/delete',
   method: 'post',
   parameter: ['jid', 'type'],
   execution: async (req, res, next) => {
      try {
         const { jid: id, type: t } = req.body
         const { type, jid } = req.session
         const DATA_MAP = {
            '_u': 'users',
            '_c': 'chats',
            '_g': 'groups',
            '_b': 'bots'
         }

         let data, target

         if (type === 1) {
            data = global.db[DATA_MAP[t]]
            target = t === '_b' ? data?.find(v => v.connector.sessionOpts.owner === id) : data?.find(v => v.jid === id)
         } else if (type === 2) {
            const bot = global?.db?.bots?.find(v =>
               v.jid === jid || v.connector.sessionOpts.owner === jid
            )

            if (!bot)
               return res.status(404).json({
                  creator: global.creator,
                  status: false,
                  message: 'Bot not found'
               })


            if (t === '_b')
               return res.status(403).json({
                  creator: global.creator,
                  status: false,
                  message: 'You are not allowed to delete this bot'
               })

            data = bot.data[DATA_MAP[t]]
            target = data?.find(v => v.jid === id)
         }

         if (!target)
            return res.status(404).json({
               creator: global.creator,
               status: false,
               message: 'Data not found'
            })

         Utils.removeItem(data, target)
         return res.json({
            creator: global.creator,
            status: true,
            message: 'Data deleted successfully'
         })
      } catch (e) {
         Utils.printError(e)
         res.status(500).json({
            creator: global.creator,
            status: false,
            message: e.message
         })
      }
   },
   error: false,
   login: true
}