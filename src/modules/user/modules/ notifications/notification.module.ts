import { Module } from '@nestjs/common';
import { FirebaseService } from './services/notification.service';

@Module({
  imports: [],
  providers: [FirebaseService],
  exports: [FirebaseService], // Export the service for use in other modules
})
export class FirebaseModule {}
