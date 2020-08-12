/* eslint-disable no-console */
const express = require('express');
const webpack = require('webpack');
const middleware = require('webpack-dev-middleware');

const compiler = webpack({
  entry: './index.js',
  output: {
    filename: 'index.min.js',
    library: 'fetchHar',
  },
  mode: 'production',
});

const port = 4444;

// https://itnext.io/testing-your-javascript-in-a-browser-with-jest-puppeteer-express-and-webpack-c998a37ef887
// https://github.com/czycha/example-jest-puppeteer-express-webpack
express()
  .use(middleware(compiler, { serverSideRender: true }))
  .use((req, res) => {
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
