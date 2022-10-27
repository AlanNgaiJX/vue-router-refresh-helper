const path = require("path");

module.exports = {
  mode: "development",
  entry: "./src/index.js",
  output: {
    path: path.resolve(__dirname, "./dist"),
    filename: "vue-router-refresh-helper.js",
    libraryTarget: "umd",
    globalObject: "this",
    // libraryExport: 'default',
    library: "vue-router-refresh-helper",
  },
  module: {
    rules: [
      {
        test: /\.(js)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
            plugins: [
              "@babel/plugin-transform-runtime",
              "@babel/plugin-proposal-object-rest-spread",
            ],
          },
        },
      },
    ],
  },
  devtool: "source-map",
};
