export const run = {
   usage: ['applemusic'],
   hidden: ['appledl'],
   use: 'query / link',
   category: 'downloader',
   async: async (m, {
      client,
      text,
      isPrefix,
      command,
      Utils
   }) => {
      try {
         if (!text) return client.reply(m.chat, `• ${Utils.texted('bold', `Example`)} :\n\n${isPrefix + command} tak ingin usai\n${isPrefix + command} https://music.apple.com/us/song/unholy-confessions/898356745`, m)

         if (!(client.applemusic instanceof Map)) {
            client.applemusic = new Map()
         }

         const check = client.applemusic.get(m.sender)

         if (check && text.match('music.apple.com')) {
            client.sendReact(m.chat, '🕒', m.key)
            const json = await Api.neoxr('/applemusic', {
               url: text
            })
            if (!json.status) return client.reply(m.chat, Utils.jsonFormat(json), m)
            let caption = `乂  *A P P L E M U S I C*\n\n`
            caption += `	◦  *Title* : ${json.data.title}\n`
            caption += `	◦  *Album* : ${json.data.album}\n`
            caption += `	◦  *Published* : ${json.data.published}\n`
            caption += `	◦  *Source* : ${json.data.source}\n\n`
            caption += global.footer
            client.sendMessageModify(m.chat, caption, m, {
               largeThumb: true,
               thumbnail: await Utils.fetchAsBuffer(json.data.thumbnail)
            }).then(async () => {
               await client.sendFile(m.chat, json.data.audio.url, json.data.audio.filename, '', m, {
                  document: true,
                  APIC: await Utils.fetchAsBuffer(json.data.thumbnail)
               })
            })

         } else if (!check && !isNaN(text)) {
            return m.reply(Utils.texted('bold', `🚩 Your session has expired / does not exist, do another search using the keywords you want.`))
         } else if (check && !isNaN(text)) {
            if (Number(text) > check.results.length) return m.reply(Utils.texted('bold', `🚩 Exceed amount of data.`))
            client.sendReact(m.chat, '🕒', m.key)
            const json = await Api.neoxr('/applemusic', {
               url: check.results[Number(text) - 1]?.trim()
            })
            if (!json.status) return client.reply(m.chat, Utils.jsonFormat(json), m)
            let caption = `乂  *A P P L E M U S I C*\n\n`
            caption += `	◦  *Title* : ${json.data.title}\n`
            caption += `	◦  *Album* : ${json.data.album}\n`
            caption += `	◦  *Published* : ${json.data.published}\n`
            caption += `	◦  *Source* : ${json.data.source}\n\n`
            caption += global.footer
            client.sendMessageModify(m.chat, caption, m, {
               largeThumb: true,
               thumbnail: await Utils.fetchAsBuffer(json.data.thumbnail)
            }).then(async () => {
               client.sendFile(m.chat, json.data.audio.url, json.data.audio.filename, '', m, {
                  document: true,
                  APIC: await Utils.fetchAsBuffer(json.data.thumbnail)
               })
            })

         } else {
            client.sendReact(m.chat, '🕒', m.key)
            const json = await Api.neoxr('/applemusic-search', {
               q: text
            })
            if (!json.status) return client.reply(m.chat, Utils.jsonFormat(json), m)
            if (text.match('music.apple.com')) return client.sendFile(m.chat, json.data.url, json.data.title + '.mp3', '', m, {
               document: true
            })

            const newSession = {
               results: json.data.map(v => v.url),
               created_at: new Date() * 1
            }
            client.applemusic.set(m.sender, newSession)

            let p = `To download use this command *${isPrefix + command} number*\n`
            p += `*Example* : ${isPrefix + command} 1\n\n`
            json.data.forEach((v, i) => {
               p += `*${i + 1}*. ${v.title}\n`
               p += `◦ *Link* : ${v.url}\n\n`
            })
            p += global.footer
            client.reply(m.chat, p, m)
         }

         setInterval(async () => {
            for (const [jid, session] of client.applemusic.entries()) {
               if (session && new Date() - session.created_at > global.timer) {
                  client.applemusic.delete(jid)
               }
            }
         }, 60_000)

      } catch (e) {
         console.log(e)
         return client.reply(m.chat, Utils.jsonFormat(e), m)
      }
   },
   error: false,
   limit: true
}