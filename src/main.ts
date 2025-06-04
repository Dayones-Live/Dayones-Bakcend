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
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  
  // Enable CORS
  app.enableCors({
    origin: true, // Allow all origins
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });
  
  app.setGlobalPrefix('api/v1');
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/document', app, document);
  app.useGlobalPipes(new ValidationPipe());

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
