import { fileURLToPath } from "node:url";
import HtmlWebpackPlugin from "html-webpack-plugin";
import CopyWebpackPlugin from "copy-webpack-plugin";

export default {
  entry: {
    popup: "./src/popup/index.js",
    content: "./src/content/content.js",
    background: "./src/background/background.js",
  },
  output: {
    path: fileURLToPath(new URL("./dist", import.meta.url)),
    filename: "[name].js",
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-react"],
          },
        },
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: fileURLToPath(new URL("./manifest.json", import.meta.url)),
          to: "manifest.json",
        },
        {
          from: fileURLToPath(new URL("./icon.png", import.meta.url)),
          to: "icon.png",
        },
      ],
    }),
    new HtmlWebpackPlugin({
      template: "./src/popup/index.html",
      filename: "popup.html",
      chunks: ["popup"],
    }),
  ],
  resolve: {
    extensions: [".js", ".jsx", ".mjs", ".cjs"],
  },
};
