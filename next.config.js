/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    PIXABAY_API_KEY: process.env.PIXABAY_API_KEY,
  },
}

module.exports = nextConfig