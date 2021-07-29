/* eslint-disable no-console */
const webpack = require('webpack');
const middleware = require('webpack-dev-middleware');
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const multer = require('multer');

// https://itnext.io/testing-your-javascript-in-a-browser-with-jest-puppeteer-express-and-webpack-c998a37ef887
// https://github.com/czycha/example-jest-puppeteer-express-webpack
const compiler = webpack({
  entry: './index.js',
  mode: 'production',
  output: {
    filename: 'index.min.js',
    library: 'fetchHar',
  },
  plugins: [
    // https://github.com/webpack/changelog-v5/issues/10#issuecomment-615877593
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
  ],
});

const port = 4444;

express()
  .use(middleware(compiler, { serverSideRender: true }))
  .use(cookieParser())
  .use(bodyParser.json())
  .use(bodyParser.raw())
  .use(bodyParser.text())
  .use(bodyParser.urlencoded({ extended: true }))
  .use(multer({ storage: multer.memoryStorage() }).any())
  .all('/debug', (req, res) => {
    res.json({
      method: req.method,
      headers: req.headers,
      cookies: req.cookies,
      query: req.query,
      params: req.params,
      body: req.body,
      files: req.files,
    });
  })
  .get('/', (req, res) => {
    res.send(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Test</title>
        </head>
        <body>
          <div id="root"></div>
          <script src="index.min.js"></script>
        </body>
      </html>`
    );
  })
  .listen(port, () => {
    console.log(`Server started at http://localhost:${port}/`);
  });
