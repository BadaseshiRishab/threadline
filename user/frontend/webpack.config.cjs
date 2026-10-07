const path = require('node:path')
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = (_environment, arguments_) => {
  const development = arguments_.mode !== 'production'
  return {
    mode: development ? 'development' : 'production',
    entry: './src/main.tsx',
    output: { path: path.resolve(__dirname, 'dist'), filename: 'assets/[name].[contenthash].js', publicPath: '/', clean: true },
    resolve: { extensions: ['.tsx', '.ts', '.js'] },
    module: {
      rules: [
        { test: /\.tsx?$/, exclude: /node_modules/, use: [{ loader: 'ts-loader', options: { configFile: 'tsconfig.app.json', transpileOnly: true, compilerOptions: { noEmit: false } } }] },
        { test: /\.css$/i, use: ['style-loader', 'css-loader'] },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({ template: './index.html' }),
      new webpack.DefinePlugin({ 'process.env.API_BASE_URL': JSON.stringify(process.env.API_BASE_URL || '/api') }),
    ],
    devServer: { host: '0.0.0.0', port: 5175, hot: true, historyApiFallback: true, proxy: [{ context: ['/api'], target: 'http://127.0.0.1:4003' }] },
  }
}
