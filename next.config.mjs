/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/:slug.html", destination: "/:slug", permanent: true },
      { source: "/services/:slug.html", destination: "/services/:slug", permanent: true },
      { source: "/locations/:slug.html", destination: "/locations/:slug", permanent: true },
    ];
  },
};

export default nextConfig;
