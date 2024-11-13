// webpack.config.js
const path = require('path');

module.exports = {
  entry: './packages/contentstack/bin/run',

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'cli.bundle.js',
  },
  module: {
    rules: [
      {
        test: /\.ts$/, // Apply this rule for all .ts files
        use: 'ts-loader', // Use ts-loader to handle TypeScript files
      },
    ],
  },
  resolve: {
    // Add .ts and .js extensions so they can be resolved in imports
    extensions: ['.ts', '.js', '.lite'],
  },
  target: 'node',
  mode: 'production',
  optimization: {
    minimize: false, // Disable minification temporarily
  },
};
