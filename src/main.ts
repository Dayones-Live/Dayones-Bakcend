import { AppModule } from './app.module';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { swaggerConfig } from './config/swagger/swagger';
import { SocketModule } from './modules/user/modules/socket/socket.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/document', app, document);
  app.useGlobalPipes(new ValidationPipe());

  const socketModule = app.get(SocketModule);
  socketModule.setHttpServer(app.getHttpServer());

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
