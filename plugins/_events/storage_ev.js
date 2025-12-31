import mime from 'mime-types'
import axios from 'axios'

export const run = {
   async: async (m, {
      client,
      body,
      setting,
      storage,
      Utils
   }) => {
      try {
         const files = storage?.find(v => body && v.name == body.toLowerCase())
         if (files) {
            const fileUrl = (files.url.match(/\./g) || []).length === 1 ? `${files.url}.${mime.extension(files.mime)?.replace('jpeg', 'jpg')}` : files.url
            const { data } = await axios.get(fileUrl, {
               responseType: 'arraybuffer',
               headers: {
                  'Referer': 'https://qu.ax/'
               }
            })

            const buffer = Buffer.from(data)

            if (/audio/.test(files.mime)) {
               client.sendFile(m.chat, buffer, files.filename, '', m, {
                  ptt: files.ptt
               })
            } else if (/webp/.test(files.mime)) {
               client.sendSticker(m.chat, buffer, m, {
                  packname: setting.sk_pack,
                  author: setting.sk_author
               })
            } else {
               client.sendFile(m.chat, buffer, files.filename, '', m)
            }
         }
      } catch (e) {
         return client.reply(m.chat, Utils.jsonFormat(e), m)
      }
   }
}