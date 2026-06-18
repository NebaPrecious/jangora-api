import { TypeOrmModuleOptions } from '@nestjs/typeorm';
//console.log('DB PASSWORD:', process.env.DB_PASSWORD);

export const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,

  autoLoadEntities: true,

  synchronize: true,
};
