const isDev = process.env.NODE_ENV === "development";

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: isDev,
})

module.exports = withPWA({

  reactStrictMode: false,
  trailingSlash: true,
  // next.js config
  // reactStrictMode: true, 
})


// const withPWA = require("next-pwa");


// module.exports = withPWA({
//   reactStrictMode: false,
//   trailingSlash: true,
//   pwa: {
//     dest: "public",
//     register: true,
//     skipWaiting: true,
//   },
// });



// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   reactStrictMode: false,
//   // swcMinify: true,
//   // experimental: {
//   //   appDir: true
//   // },

//   trailingSlash: true
// }

// module.exports = nextConfig
