/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow all common local network IPs for development
  allowedDevOrigins: [
    '192.168.0.109',  // Existing IP
    '172.20.10.2',    // Current hotspot IP
    'localhost',
    '127.0.0.1',
  ],

  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    unoptimized: true,
  },
};

export default nextConfig;