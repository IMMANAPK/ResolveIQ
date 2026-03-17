import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailTrackerController } from './email-tracker.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [NotificationsModule, GatewayModule],
  providers: [EmailService],
  controllers: [EmailTrackerController],
  exports: [EmailService],
})
export class EmailModule {}
