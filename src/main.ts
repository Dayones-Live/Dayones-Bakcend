import { AppModule } from './app.module'; 
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { swaggerConfig } from './config/swagger/swagger';
import { SocketModule } from './modules/user/modules/socket/socket.module';
import { RolesGuard } from './modules/auth/guards/role.guard';
import { CognitoGuard } from './modules/auth/guards/aws.cognito.guard';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Log DB connection details for debugging
  logger.log('DB DEBUG:', {
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    db: process.env.DB_NAME,
    env: process.env.NODE_ENV,
  });

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  
  // Enable CORS with more specific configuration
  app.enableCors({
    origin: ['https://dayones.app', 'http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 3600,
  });
  
  app.setGlobalPrefix('api/v1');
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/document', app, document);
  
  // Add global validation pipe with better error handling
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    errorHttpStatusCode: 422,
  }));

  const socketModule = app.get(SocketModule);
  socketModule.setHttpServer(app.getHttpServer());
  const cognitoGuard = app.get(CognitoGuard);
  app.useGlobalGuards(cognitoGuard, new RolesGuard(new Reflector()));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Swagger documentation is available at: http://localhost:${port}/api/document`);
}
bootstrap();
