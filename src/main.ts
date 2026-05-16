import { AppModule } from './app.module';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { swaggerConfig } from './config/swagger/swagger';
import { SocketModule } from './modules/user/modules/socket/socket.module';
import { RolesGuard } from './modules/auth/guards/role.guard';
import { CognitoGuard } from './modules/auth/guards/aws.cognito.guard';
import { redactSensitive } from './shared/logger/safe-logger';

function installSafeConsole() {
  const safeLogger = new Logger('Console');
  const sanitize = (args: unknown[]): unknown[] =>
    args.map((a) => (a && typeof a === 'object' ? redactSensitive(a) : a));

  const isProd = process.env.NODE_ENV === 'production';

  console.log = (...args: unknown[]) => {
    if (isProd) return;
    safeLogger.log(sanitize(args).map(String).join(' '));
  };
  console.debug = (...args: unknown[]) => {
    if (isProd) return;
    safeLogger.debug(sanitize(args).map(String).join(' '));
  };
  console.info = (...args: unknown[]) => {
    safeLogger.log(sanitize(args).map(String).join(' '));
  };
  console.warn = (...args: unknown[]) => {
    safeLogger.warn(sanitize(args).map(String).join(' '));
  };
  console.error = (...args: unknown[]) => {
    const cleaned = sanitize(args);
    const message = cleaned.map((a) => (a instanceof Error ? a.message : String(a))).join(' ');
    const stack = args.find((a): a is Error => a instanceof Error)?.stack;
    safeLogger.error(message, stack);
  };
}

async function bootstrap() {
  installSafeConsole();
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
    rawBody: true,
  });

  app.use(helmet());
  app.enableCors({
    origin: ['https://dayones.app', 'http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 3600,
  });

  app.setGlobalPrefix('api/v1');

  if (process.env.NODE_ENV !== 'production') {
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    document.security = [{ bearer: [] }];

    // Strip the /api/v1 global prefix from path keys so that the spec's
    // `paths` are relative and the `servers` block carries the base path.
    // This keeps generated clients from hard-coding /api/v1 into every
    // per-method URL, which would otherwise double up with the dio baseUrl.
    const rewritten: typeof document.paths = {};
    for (const [path, ops] of Object.entries(document.paths)) {
      const stripped = path.replace(/^\/api\/v1/, '') || '/';
      rewritten[stripped] = ops;
    }
    document.paths = rewritten;

    SwaggerModule.setup('api/document', app, document, {
      jsonDocumentUrl: 'api/v1/openapi.json',
      yamlDocumentUrl: 'api/v1/openapi.yaml',
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      errorHttpStatusCode: 422,
      disableErrorMessages: process.env.NODE_ENV === 'production' ? false : false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const socketModule = app.get(SocketModule);
  socketModule.setHttpServer(app.getHttpServer());
  const cognitoGuard = app.get(CognitoGuard);
  app.useGlobalGuards(cognitoGuard, new RolesGuard(new Reflector()));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Application is running on port ${port}`);
  if (process.env.NODE_ENV !== 'production') {
    logger.log(`Swagger UI: http://localhost:${port}/api/document`);
    logger.log(`OpenAPI JSON: http://localhost:${port}/api/v1/openapi.json`);
  }
}
bootstrap();
