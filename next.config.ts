import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    allowedDevOrigins: ['http://localhost:3000', '192.168.18.106'],
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
