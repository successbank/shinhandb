import express, { Application, Request, Response } from 'express';
import dotenv from 'dotenv';
import { corsMiddleware } from './middlewares/cors';
import { errorHandler } from './middlewares/errorHandler';
import routes from './routes';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3001;

app.use(corsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║  신한금융 광고관리 플랫폼 API 서버           ║
║  Port: ${PORT}
║  Environment: ${process.env.NODE_ENV || 'development'}
║  Status: Running ✓                           ║
╚══════════════════════════════════════════════╝
  `);
});

export default app;
