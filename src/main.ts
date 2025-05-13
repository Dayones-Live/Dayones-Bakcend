import { AppModule } from './app.module'; 
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { swaggerConfig } from './config/swagger/swagger';
import { SocketModule } from './modules/user/modules/socket/socket.module';
import { RolesGuard } from './modules/auth/guards/role.guard';
import { CognitoGuard } from './modules/auth/guards/aws.cognito.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/document', app, document);
  app.useGlobalPipes(new ValidationPipe());

  const socketModule = app.get(SocketModule);
  socketModule.setHttpServer(app.getHttpServer());
  const cognitoGuard = app.get(CognitoGuard);
  app.useGlobalGuards(cognitoGuard, new RolesGuard(new Reflector()));

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
