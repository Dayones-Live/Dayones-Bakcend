import { DocumentBuilder } from '@nestjs/swagger';
export const swaggerConfig = new DocumentBuilder()
  .setTitle('Days One API Document')
  .setDescription('The Days One API description')
  .setVersion('1.0')
  .addTag('daysone')
  .build();
