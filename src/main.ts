import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow our frontend origin(s).
  // Set FRONTEND_URL in Render's env vars once the frontend is deployed,
  // e.g. https://crossborderx-frontend.vercel.app
  const allowedOrigins = [
    'http://localhost:3001',
    'http://localhost:3000',
    process.env.FRONTEND_URL,
    // Allow all Vercel preview deployments for the frontend project.
    // Format: https://<branch>-<project>.vercel.app
    /\.vercel\.app$/,
  ].filter(Boolean) as (string | RegExp)[];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Graceful shutdown — give in-flight requests up to 5s to finish
  // when the platform sends SIGTERM (e.g. on redeploy).
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Listening on port ${port}`);
}
bootstrap();