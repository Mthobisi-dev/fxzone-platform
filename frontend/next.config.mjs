// When BACKEND_URL is set (e.g. https://fxzone-api.onrender.com) every /api/* request is proxied to the
// standalone FastAPI service in ../backend. When it is unset the built-in Next.js API routes keep serving
// /api/* exactly as before, so switching is a pure deploy-time decision.
const backendUrl = (process.env.BACKEND_URL || '').replace(/\/+$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    if (!backendUrl) return [];
    // beforeFiles: takes precedence over the app/api route handlers
    return { beforeFiles: [{ source: '/api/:path*', destination: `${backendUrl}/api/:path*` }] };
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
