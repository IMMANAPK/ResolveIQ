import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComplaintsService } from './complaints.service';
import { ComplaintsController } from './complaints.controller';
import { ComplaintNotifierService } from './complaint-notifier.service';
import { Complaint } from './entities/complaint.entity';
import { TimelineEvent } from './entities/timeline-event.entity';
import { AIAction } from './entities/ai-action.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Complaint, TimelineEvent, AIAction]),
    NotificationsModule,
    EmailModule,
    UsersModule,
  ],
  providers: [ComplaintsService, ComplaintNotifierService],
  controllers: [ComplaintsController],
  exports: [ComplaintsService],
})
export class ComplaintsModule {}
