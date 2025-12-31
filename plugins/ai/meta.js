export const run = {
   usage: ['meta'],
   use: 'prompt',
   category: 'ai',
   async: async (m, {
      client,
      text,
      Utils
   }) => {
      try {
         // client.meta = client.meta ? client.meta : []
         global.db.meta = global.db.meta ? global.db.meta : {}
         if (!text) return client.reply(m.chat, Utils.texted('bold', `🚩 Please provide a prompt.`), m)
         client.sendReact(m.chat, '🕒', m.key)
         // if (client.meta.includes(m.sender)) return client.reply(m.chat, Utils.texted('bold', `🚩 Please wait for the previous request to finish.`), m)
         // if (!client.meta.includes(m.sender)) {
         //    client.meta.push(m.sender)
         // }
         if (global.db.meta[m.sender]) {
            const json = await Api.neoxr('/meta', {
               q: encodeURIComponent(text),
               session: global.db.meta[m.sender].session
            })
            if (!json.status) return client.reply(m.chat, Utils.texted('bold', `🚩 ${json.msg}`), m).then(() => {
               // client.meta.splice(client.meta.indexOf(m.sender), 1)
            })
            if (json?.data?.message) return m.reply(json.data.message)
            if (json?.data?.media) {
               const files = json.data.media.map(v => ({
                  url: v.uri
               }))
               client.sendAlbumMessage(m.chat, files, m)
               // client.meta.splice(client.meta.indexOf(m.sender), 1)
            }
         } else {
            global.db.meta[m.sender] = {}
            const json = await Api.neoxr('/meta', {
               q: encodeURIComponent(text)
            })
            if (!json.status) return client.reply(m.chat, Utils.texted('bold', `🚩 ${json.msg}`), m).then(() => {
               // client.meta.splice(client.meta.indexOf(m.sender), 1)
            })
            if (json?.data?.message) return m.reply(json.data.message.replace(/\*\*/g, '*')).then(() => {
               global.db.meta[m.sender].session = json.data.session
            })
            if (json?.data?.media) {
               const files = json.data.media.map(v => ({
                  url: v.uri
               }))
               client.sendAlbumMessage(m.chat, files, m)
               global.db.meta[m.sender].session = json.data.session
               // client.meta.splice(client.meta.indexOf(m.sender), 1)
            }
         }
      } catch (e) {
         client.reply(m.chat, Utils.jsonFormat(e), m)
      }
   },
   error: false,
   limit: true
}