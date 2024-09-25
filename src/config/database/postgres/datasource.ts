import databaseConfig from './orm.config';
import { DataSource } from 'typeorm';

export const dataSource = new DataSource(databaseConfig);
