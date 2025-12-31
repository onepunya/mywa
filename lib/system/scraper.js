import { Scraper, Utils } from '@neoxr/wb'
import axios from 'axios'
import * as cheerio from 'cheerio'
import retry from 'async-retry'
import pkg from 'file-type'
const { fromBuffer } = pkg
import FormData from 'form-data'

Scraper.quax = async (buffer) => {
   try {
      const getExt = async (buf) => (await fromBuffer(buf))?.ext || 'txt'
      const form = new FormData()
      form.append('files[]', Buffer.from(buffer), `${Date.now()}.${await getExt(buffer)}`)
      form.append('expiry', '-1')

      const response = await retry(async () => {
         const json = await (await axios.post('https://qu.ax/upload', form, {
            headers: {
               'Referer': 'https://qu.ax/',
               ...form.getHeaders()
            }
         })).data

         if (!json.success) throw new Error('Upload failed!')
         return json
      }, {
         retries: 5,
         factor: 2,
         minTimeout: 1500,
         maxTimeout: 2000
      })

      if (!response?.success) throw new Error('Upload failed!')

      return {
         creator: global.creator,
         status: true,
         data: response.files[0]
      }
   } catch (e) {
      Utils.printError(e)
      return {
         creator: global.creator,
         status: false,
         msg: e.message || 'Failed to upload file'
      }
   }
}


Scraper.myAnimeList = async () => {
   try {
      const limit = Math.floor(Math.random() * 500) + 1
      const response = await fetch(`https://myanimelist.net/character.php?limit=${limit}`)
      const html = await response.text()
      const $ = cheerio.load(html)

      const collect = {
         r: [],
         anime: []
      }

      $('table > tbody > tr > td').each((_, element) => {
         const txt = $(element).find('a').eq(1).text().trim()
         const imgSrc = $(element).find('img').attr('data-srcset')
         const link = $(element).find('a').attr('href')

         const url = imgSrc ?? link
         const low = url ? url.replace('https://', '').split('/')[1] : ''

         if (low && collect[low]) {
            collect[low].push({ text: txt.replace(',', ''), url })
         }
      })

      if (!collect.r || !collect.anime) throw new Error('Failed to fetch data')

      const randIndex = Math.floor(Math.random() * collect.r.length)
      const r = collect.r[randIndex]
      const anime = collect.anime[randIndex]

      return {
         creator: global.creator,
         status: true,
         data: {
            name: r?.text ?? '',
            anime: anime?.text ?? '',
            image: (r?.url ? r.url.split(',')[1].trim().split(' ')[0] : '')?.replace(new RegExp('100x156', 'g'), '400x624')
         }
      }
   } catch (e) {
      Utils.printError(e)
      return {
         creator: global.creator,
         status: false,
         msg: e.message || 'Failed to fetch data'
      }
   }
}
