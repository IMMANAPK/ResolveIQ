import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EmailService } from './email.service';
import { EmailProcessor, EMAIL_QUEUE } from './email.processor';
import { EmailTrackerController } from './email-tracker.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: EMAIL_QUEUE }),
    NotificationsModule,
    GatewayModule,
  ],
  providers: [EmailService, EmailProcessor],
  controllers: [EmailTrackerController],
  exports: [EmailService],
})
export class EmailModule {}
