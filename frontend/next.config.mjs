/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: false,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'media.thepurple.in',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/orders',
        destination: '/my-orders',
        permanent: true,
      },
      {
        source: '/orders/:id',
        destination: '/my-orders/:id',
        permanent: true,
      },
    ];
  },
  onDemandEntries: {
    // Keep compiled pages in memory for fast instant navigation
    maxInactiveAge: 4 * 60 * 60 * 1000,
    pagesBufferLength: 50,
  },
};

export default nextConfig;
