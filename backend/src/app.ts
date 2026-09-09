import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import apiRoutes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { env } from './config/env';

export function createApp() {
  const app = express();

  app.use(helmet());

  app.use(
    cors({
      origin: env.frontendUrl,
      credentials: true
    })
  );

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok'
    });
  });

  app.use('/v1', apiRoutes);

  if (env.nodeEnv !== 'production') {
    const swaggerDocument = require('../swagger.json');
    app.use(
      '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(swaggerDocument)
    );
  }

  app.use(errorHandler);

  return app;
}
