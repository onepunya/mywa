import { Config, Utils } from '@neoxr/wb'
import { parsingData } from '../../utils/index.js'

export const routes = {
   category: 'action',
   path: '/action/update-setting',
   method: 'post',
   parameter: ['data'],
   execution: async (req, res, next) => {
      try {
         const { data: newSettings } = req.body

         if (!newSettings || typeof newSettings !== 'object')
            return res.status(400).json({
               creator: global.creator,
               status: false,
               message: 'Invalid settings data provided'
            })

         const { type, jid } = req.session

         const data = parsingData(type, jid)

         if (!data)
            return res.status(404).json({
               creator: global.creator,
               status: false,
               message: 'Bot not found'
            })

         let { bot, setting } = data
         if (!setting) setting = {}

         if (bot && bot?.plan != 'none') {
            const choosenPlan = Config.bot_hosting.price_list.find(v => v.code === bot.plan)
            if (newSettings.owners.length > (choosenPlan.owner + (bot?.max_owner || 0))) return res.status(400).json({
               creator: global.creator,
               status: false,
               message: 'You have reached the maximum number of owners for this plan'
            })
         }

         for (const key in newSettings) {
            if (Object.prototype.hasOwnProperty.call(setting, key)) {
               setting[key] = newSettings[key]
            }
         }

         res.json({
            creator: global.creator,
            status: true,
            message: 'Settings updated successfully'
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