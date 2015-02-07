/**
 * Webpack configuration
 */

var path = require("path");
var webpack = require("webpack");

module.exports = {
  cache: true,
  context: path.join(__dirname, "app"),
  entry: "./js/app.js",
  output: {
    path: path.join(__dirname, "app", "dist", "js"),
    filename: "app.bundle.js"
  },
  externals: [
    "io",
    "window",
    "document",
    "Auth0Widget"
  ],
  module: {
    loaders: [
      { test: /\.jsx$/, loader: "jsx-loader" },
      { test: /\.json$/, loader: "json-loader" },
      // Backbone somehow hit's the AMD code path instead of CommonJS one.
      { test: /backbone\.js$/, loader: "imports?define=>false" }
    ]
  },
  resolve: {
    alias: {
      "underscore": "lodash/dist/lodash.underscore"
    }
  },
  plugins: [
    // Optimize
    new webpack.optimize.DedupePlugin(),
    // new webpack.optimize.UglifyJsPlugin(),
    // new webpack.DefinePlugin({
    //   "process.env": {
    //     NODE_ENV: JSON.stringify("production") // Signal production mode for React JS libs.
    //   }
    // }),
    // Manually do source maps to use alternate host.
    new webpack.SourceMapDevToolPlugin(
      "app.bundle.js.map",
      "\n//# sourceMappingURL=http://127.0.0.1:5000/js/[url]")
  ]
};
