import { Handler } from '@netlify/functions';
import express from 'express';
import serverless from 'serverless-http';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const serverEntry = join(process.cwd(), 'dist/habitTracker/server/server.mjs');

let cachedHandler: Handler | null = null;

const getHandler = async (): Promise<Handler> => {
  if (cachedHandler) {
    return cachedHandler;
  }

  const serverModule = await import(pathToFileURL(serverEntry).href);
  const reqHandler = serverModule.reqHandler as (req: any, res: any) => void;

  const app = express();
  app.use((req, res) => reqHandler(req, res));

  cachedHandler = serverless(app);
  return cachedHandler;
};

const handler: Handler = async (event, context) => {
  const resolvedHandler = await getHandler();
  return resolvedHandler(event, context);
};

export { handler };
