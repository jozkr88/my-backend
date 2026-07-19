const path = require('path');

module.exports = {
  webpack: {
    configure: (config) => {
      config.resolve.fallback = {
        "path": require.resolve("path-browserify"),
        "zlib": require.resolve("browserify-zlib"),
        "querystring": require.resolve("querystring-es3"),
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "http": require.resolve("stream-http"),
        "fs": false,
        "net": false,
      };

      config.resolve.alias = {
        ...config.resolve.alias,
        path: require.resolve("path-browserify"),
      };

      return config;
    },
  },
};
