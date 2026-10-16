import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The standalone tuner was replaced by the tuner in the effects drawer
  async redirects() {
    return [{ source: '/tuner', destination: '/effects', permanent: true }]
  },
}

export default nextConfig
