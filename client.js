import { Client, Utils, Config, Database, JID } from '@neoxr/wb'
import baileys from './lib/baileys.js'
import './error.js'
import './lib/system/scraper.js'
import './lib/system/functions.js'
import './lib/system/config.js'
import './extractor/proto.js'
import cron from 'node-cron'
import fs from 'node:fs'
import colors from 'colors'
import bytes from 'bytes'
import Mapping, { clone } from './lib/system/mapping.js'
import extra from './lib/system/listeners-extra.js'
import connection from './lib/system/listeners-connection.js'
import TaskScheduler from './lib/system/scheduler.js'
import Market from './lib/system/market.js'
import { stringify } from 'flatted'
import system from './lib/system/adapter.js'

const connect = async () => {
   try {
      const client = new Client({
         plugsdir: 'plugins',
         presence: true,
         online: true,
         bypass_disappearing: true,
         pairing: Config.pairing,
         create_session: {
            type: system.session,
            session: 'session',
            config: process.env.DATABASE_URL,
         },
         custom_id: 'neoxr', // Prefix for Custom Message ID (automatically detects isBot for itself)
         bot: Utils.isBot,
         multiple: true,
         server: process.argv.includes('--server'),
         engines: [baileys],
         debug: false // if want to see how this module work :v
      }, {
         browser: Config.pairing.browser,
         shouldIgnoreJid: jid => {
            return /(newsletter|bot)/.test(jid)
         }
      })

      client._bind(connection(system))

      client.on('error', async error => {
         console.error(colors.red(error.message))
         if (error && typeof error === 'object' && error.message) Utils.logFile(error.message)
      })

      client.once('connect', async res => {
         try {
            const defaults = { users: [], chats: [], players: [], groups: [], statistic: {}, sticker: {}, setting: {}, setup: {}, bots: [], instance: [], anon: {}, menfess: [] }
            const previous = await system.database.fetch()
            if (!previous || typeof previous !== 'object' || !Object.keys(previous).length) {
               global.db = defaults
               await system.database.save(defaults)
            } else {
               global.db = previous
            }
         } catch (e) {
            Utils.printError(e)
         }
         if (res && typeof res === 'object' && res.message) Utils.logFile(res.message)
      })

      client.once('ready', async () => {
         if (client?.plugins) Mapping.property.set('plugins', client.plugins)
         if (client?.commands) Mapping.property.set('commands', client.commands)

         if (!Array.isArray(global.db.bots)) global.db.bots = []

         if (process.argv.includes('--server')) {
            const isOn = await Utils.isPortInUse(Config.bot_hosting.host)
            if (!isOn) await import('./core/app.js')
         }

         clone.set('sync', client)

         const options = JID(client.sock)
         const schedule = new TaskScheduler(client.sock, options)
         schedule.start(15)
         if (!Mapping.schedule.has(Utils.noSuffix(client.sock.user.id))) Mapping.schedule.set(
            Utils.noSuffix(client.sock.user.id),
            schedule
         )

         const market = new Market(client.sock)
         market.setGroups(global.db.groups)
         if (!Mapping.market.has(Utils.noSuffix(client.sock.user.id))) Mapping.market.set(
            Utils.noSuffix(client.sock.user.id),
            market
         )

         const ramCheck = setInterval(() => {
            var ramUsage = process.memoryUsage().rss
            if (ramUsage >= bytes(Config.ram_limit)) {
               clearInterval(ramCheck)
               process.send('reset')
            }
         }, 60 * 1000)

         setInterval(async () => {
            if (global.db) await system.database.save(global.db)
         }, 60 * 1000 * (['local', 'sqlite'].includes(system.session) ? 3 : 5))

         cron.schedule('0 12 * * *', async () => {
            if (global?.db?.setting?.autobackup) {
               await system.database.save(global.db)
               fs.writeFileSync(Config.database + '.json', stringify(global.db), 'utf-8')
               await client.sock.sendFile(Config.owner + '@s.whatsapp.net', fs.readFileSync('./' + Config.database + '.json'), Config.database + '.json', '', null)
            }
         })

         cron.schedule('00 00 * * *', () => {
            if (global?.db?.users && global?.db?.statistic) {
               const data = global.db
               data.setting.lastReset = Date.now()
               data.users.filter(v => v.limit < Config.limit && !v.premium).map(v => v.limit = Config.limit)
               data.users.filter(v => v.limit_game < Config.limit_game && !v.premium).map(v => v.limit_game = Config.limit_game)
               Object.entries(data.statistic).map(([_, prop]) => prop.today = 0)
            }

            if (global?.db?.bots?.length) {
               for (let v of global.db.bots) {
                  const data = v.data
                  data.setting.lastReset = Date.now()
                  data.users.filter(v => v.limit < Config.limit && !v.premium).map(v => v.limit = Config.limit)
                  data.users.filter(v => v.limit_game < Config.limit_game && !v.premium).map(v => v.limit_game = Config.limit_game)
                  if (data.statistic) Object.entries(data.statistic).map(([_, prop]) => prop.today = 0)
               }
            }
         })
      })

      extra(system)(client)
   } catch (e) {
      Utils.printError(e)
   }
}

connect().catch(() => connect())