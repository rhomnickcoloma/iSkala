import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: '/nixx',
      },
    ],
    sitemap: 'https://fretwiki.com/sitemap.xml',
  }
}
