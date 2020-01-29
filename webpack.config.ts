const path = require('path');
const fs = require('fs');

var nodeModules: any = {};
fs.readdirSync('node_modules')
  .filter((x: any) => ['.bin'].indexOf(x) === -1)
  .forEach((mod: any) => nodeModules[mod] = 'commonjs ' + mod);


module.exports = {
  entry: './src/index.ts',
  mode: 'development',
  target: 'node',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  externals: nodeModules,
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  node: { fs: 'empty' },
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
  },
};