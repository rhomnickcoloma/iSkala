import { renderOgImage } from './lib/ogImage'

export const alt = 'FretWiki — Interactive Scale Reference for Guitar, Bass & Ukulele'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return renderOgImage('Interactive scales for guitar, bass & ukulele')
}
