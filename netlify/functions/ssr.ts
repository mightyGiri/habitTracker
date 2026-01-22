import { Handler } from '@netlify/functions';
import express from 'express';
import serverless from 'serverless-http';
import { join } from 'node:path';

const app = express();
const browserDistFolder = join(process.cwd(), 'dist/habitTracker/browser');
const manifestPath = join(process.cwd(), 'dist/habitTracker/server/angular-app-engine-manifest.mjs');

let angularApp: any;
let writeResponseToNodeResponse: any;
let initPromise: Promise<void> | null = null;

const initAngularApp = (): Promise<void> => {
  if (initPromise) {
    return initPromise;
  }
  initPromise = (async () => {
    process.env['ANGULAR_APP_ENGINE_MANIFEST'] = manifestPath;
    const ssr = await import('@angular/ssr/node');
    angularApp = new ssr.AngularNodeAppEngine();
    writeResponseToNodeResponse = ssr.writeResponseToNodeResponse;
  })();
  return initPromise;
};

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false
  })
);

app.use((req, res, next) => {
  initAngularApp()
    .then(() => angularApp.handle(req))
    .then((response: any) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

const handler: Handler = serverless(app);

export { handler };
