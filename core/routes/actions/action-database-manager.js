import { Utils } from '@neoxr/wb'
import { encrypt, decrypt } from '../../utils/index.js'
import multer from 'multer'
import { uploadWithName } from '@neoxr/helper'
import { createHash, randomBytes } from 'crypto'

const storage = multer.memoryStorage()

const uploader = multer({
   storage: storage,
   limits: {
      fileSize: 10 * 1024 * 1024
   },
   fileFilter: (req, file, cb) => {
      if (!file) return cb(null, true)
      if (file.mimetype === 'application/json') {
         cb(null, true)
      } else {
         cb(new Error('Invalid file type. Only JSON files are allowed.'), false)
      }
   }
})

const challengeCache = new Map()
const CHALLENGE_TIMEOUT_MS = 5 * 60 * 1000
setInterval(() => {
   const now = Date.now()
   for (const [token, data] of challengeCache.entries()) {
      if (now - data.ts > CHALLENGE_TIMEOUT_MS) {
         challengeCache.delete(token)
      }
   }
}, 60000)
const DIFFICULTY_LEVEL = 3
const EXPIRY_DURATION_MS = 3 * 60 * 1000

export const routes = {
   category: 'action',
   path: '/action/database',
   method: 'post',
   middleware: [uploader.single('file')],
   execution: async (req, res, next) => {
      try {
         const { id, action, query } = req.body
         const now = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Jakarta',
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
         })
            .format(new Date())
            .replace(', ', '_')
            .replace(/:/g, '-')

         const bot = global.db.bots?.find(v => v._id === id)

         if (!bot)
            return res.status(404).json({
               creator: global.creator,
               status: false,
               message: 'Bot not found'
            })

         if (action === 'backup') {
            const dataEnc = encrypt(bot.data)
            const bufferData = Buffer.from(JSON.stringify(dataEnc))
            const result = await uploadWithName(bufferData, `backup-${bot.connector.sessionOpts.number}-${now}.json`)

            if (!result.status)
               return res.status(400).json({
                  creator: global.creator,
                  status: false,
                  message: 'Failed to upload backup'
               })

            res.json(result)

         } else if (action === 'restore') {
            const challenge = req.body.challenge ? JSON.parse(req.body.challenge) : null
            const serverBindContext = query

            if (!challenge) {
               const salt = randomBytes(16).toString('hex')
               const ts = Date.now()
               const token = randomBytes(24).toString('hex')
               challengeCache.set(token, { salt, ts, context: serverBindContext })
               setTimeout(() => { challengeCache.delete(token) }, EXPIRY_DURATION_MS)
               return res.status(428).json({
                  creator: global.creator,
                  status: false,
                  message: 'A security challenge is required to proceed.',
                  data: { salt, ts, difficulty: DIFFICULTY_LEVEL, token }
               })
            }

            const { salt, ts, solution, context, token } = challenge
            if (!salt || !ts || solution == null || !context || !token || !req.headers['x-severity'])
               return res.status(400).json({ status: false, message: 'Security challenge data is incomplete.' })

            if (req.headers['x-severity'] !== createHash('md5').update(serverBindContext).digest('hex'))
               return res.status(400).json({ status: false, message: 'Invalid security challenge context.' })

            const cachedChallenge = challengeCache.get(token)
            if (!cachedChallenge || cachedChallenge.context !== context || cachedChallenge.context !== serverBindContext) {
               challengeCache.delete(token)
               return res.status(403).json({ status: false, message: 'Challenge context mismatch or invalid token.' })
            }

            const isExpired = (Date.now() - cachedChallenge.ts) > EXPIRY_DURATION_MS
            if (isExpired) {
               challengeCache.delete(token)
               return res.status(403).json({ status: false, message: 'Security challenge expired.' })
            }

            const attempt = `${salt}:${ts}:${context}:${solution}`
            const prefix = '0'.repeat(DIFFICULTY_LEVEL)
            const hash = createHash('sha256').update(attempt).digest('hex')
            if (!hash.startsWith(prefix)) {
               challengeCache.delete(token)
               return res.status(403).json({ status: false, message: 'Invalid Proof of Work solution.' })
            }

            challengeCache.delete(token)

            if (!req.file)
               return res.status(400).json({
                  creator: global.creator,
                  status: false,
                  message: 'No backup file uploaded.'
               })

            let uploadedData
            try {
               uploadedData = JSON.parse(req.file.buffer.toString('utf8'))
            } catch (err) {
               return res.status(400).json({
                  creator: global.creator,
                  status: false,
                  message: 'Invalid JSON file format.'
               })
            }

            let decrypted
            try {
               decrypted = decrypt(uploadedData)
            } catch (err) {
               return res.status(400).json({
                  creator: global.creator,
                  status: false,
                  message: 'Failed to decrypt backup, file may be corrupted or invalid.'
               })
            }

            bot.data = decrypted

            return res.json({
               creator: global.creator,
               status: true,
               message: 'Backup restored successfully. Bot will restart.'
            })
         } else {
            return res.status(400).json({
               creator: global.creator,
               status: false,
               message: 'Invalid action specified.'
            })
         }
      } catch (e) {
         Utils.printError(e)
         if (!res.headersSent) {
            res.status(500).json({
               creator: global.creator,
               status: false,
               message: e.message
            })
         }
      }
   },
   error: false,
   login: true
}