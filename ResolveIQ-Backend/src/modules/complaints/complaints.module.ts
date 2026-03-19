import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ComplaintsService } from './complaints.service';
import { ComplaintsController } from './complaints.controller';
import { ComplaintNotifierService } from './complaint-notifier.service';
import { ComplaintRoutingProcessor } from './complaint-routing.processor';
import { Complaint } from './entities/complaint.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { AiModule } from '../ai/ai.module';
import { CommitteesModule } from '../committees/committees.module';
import { WorkflowsModule } from '../workflows/workflows.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Complaint]),
    // Register complaint-routing queue here so ComplaintRoutingProcessor can consume it
    BullModule.registerQueue({ name: 'complaint-routing' }),
    NotificationsModule,
    EmailModule,
    UsersModule,
    AiModule,
    CommitteesModule,
    forwardRef(() => WorkflowsModule),
  ],
  providers: [ComplaintsService, ComplaintNotifierService, ComplaintRoutingProcessor],
  controllers: [ComplaintsController],
  exports: [ComplaintsService],
})
export class ComplaintsModule {}
