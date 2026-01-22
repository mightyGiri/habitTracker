import { Handler } from '@netlify/functions';
import express from 'express';
import serverless from 'serverless-http';
import { AngularNodeAppEngine, writeResponseToNodeResponse } from '@angular/ssr/node';
import { join } from 'node:path';

const app = express();
const angularApp = new AngularNodeAppEngine();
const browserDistFolder = join(process.cwd(), 'dist/habitTracker/browser');

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false
  })
);

app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then(response => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

const handler: Handler = serverless(app);

export { handler };
