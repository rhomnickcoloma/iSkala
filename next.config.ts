import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The standalone tuner was replaced by the tuner in the effects drawer
      { source: '/tuner', destination: '/effects', permanent: true },
      // FretPilot was renamed to FretWiki AI
      { source: '/fretpilot', destination: '/ai', permanent: true },
    ]
  },
}

export default nextConfig
