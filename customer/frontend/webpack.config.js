const path = require('node:path')
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')

// Settings come from .env (see the file); variables already set in the environment take precedence.
require('dotenv').config({ quiet: true })

module.exports = (_environment, arguments_) => {
  const development = arguments_.mode !== 'production'
  return {
    mode: development ? 'development' : 'production',
    entry: './src/index.js',
    output: { path: path.resolve(__dirname, 'build'), filename: 'assets/[name].[contenthash].js', publicPath: '/', clean: true },
    resolve: { extensions: ['.js', '.jsx'] },
    module: {
      rules: [
        { test: /\.jsx?$/, exclude: /node_modules/, use: { loader: 'babel-loader', options: { presets: [['@babel/preset-react', { runtime: 'automatic', development }]] } } },
        { test: /\.css$/i, use: ['style-loader', 'css-loader'] },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({ template: './public/index.html' }),
      new webpack.DefinePlugin({ 'process.env.API_BASE_URL': JSON.stringify(process.env.API_BASE_URL || '/api') }),
    ],
    devServer: { host: '0.0.0.0', port: Number(process.env.PORT || 5175), hot: true, historyApiFallback: true, proxy: [{ context: ['/api'], target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:4003' }] },
  }
}
