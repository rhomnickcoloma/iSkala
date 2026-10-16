import { INSTRUMENTS } from '../lib/instruments'
import { renderOgImage } from '../lib/ogImage'

export const alt = 'FretWiki interactive scale reference'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export function generateStaticParams() {
  return Object.keys(INSTRUMENTS).map(id => ({ instrument: id }))
}

export default async function InstrumentOgImage({ params }: { params: Promise<{ instrument: string }> }) {
  const { instrument } = await params
  const name = INSTRUMENTS[instrument]?.name ?? 'Guitar, bass & ukulele'
  return renderOgImage(`Interactive ${name} scales in any key`)
}
