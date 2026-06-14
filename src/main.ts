import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  console.log('DB HOST:', process.env.DB_HOST);

  await app.listen(3000);
}
bootstrap();