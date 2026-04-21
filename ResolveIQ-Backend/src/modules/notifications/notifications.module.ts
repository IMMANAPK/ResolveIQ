import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Notification } from './entities/notification.entity';
import { NotificationRecipient } from './entities/notification-recipient.entity';
import { NotificationRule } from './entities/notification-rule.entity';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationRulesController } from './notification-rules.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationRecipient, NotificationRule]),
    UsersModule,
  ],
  providers: [NotificationsService, NotificationRulesService],
  controllers: [NotificationsController, NotificationRulesController],
  exports: [NotificationsService, NotificationRulesService],
})
export class NotificationsModule {}
