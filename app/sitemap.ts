import type { MetadataRoute } from 'next'
import { INSTRUMENTS } from './lib/instruments'

const SITE_URL = 'https://fretwiki.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return [
    { url: SITE_URL, lastModified, changeFrequency: 'weekly', priority: 1 },
    ...Object.keys(INSTRUMENTS).map(id => ({
      url: `${SITE_URL}/${id}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    })),
    ...['compare-scales', 'backing-track', 'effects'].map(route => ({
      url: `${SITE_URL}/${route}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...['about', 'terms'].map(route => ({
      url: `${SITE_URL}/${route}`,
      lastModified,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    })),
  ]
}
