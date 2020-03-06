import { readdirSync } from "fs";
import { resolve } from "path";


const nodeModules: any = {};
readdirSync('node_modules')
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
    path: resolve(__dirname, 'dist'),
  },
};