import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ComplaintsService } from './complaints.service';
import { ComplaintsController } from './complaints.controller';
import { ComplaintRoutingProcessor, COMPLAINT_ROUTING_QUEUE } from './complaint-routing.processor';
import { Complaint } from './entities/complaint.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { AiModule } from '../ai/ai.module';
import { CommitteesModule } from '../committees/committees.module';
import { GatewayModule } from '../gateway/gateway.module';
import { EMAIL_QUEUE } from '../email/email.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([Complaint]),
    BullModule.registerQueue({ name: COMPLAINT_ROUTING_QUEUE }),
    BullModule.registerQueue({ name: EMAIL_QUEUE }),
    NotificationsModule,
    EmailModule,
    UsersModule,
    AiModule,
    CommitteesModule,
    GatewayModule,
  ],
  providers: [ComplaintsService, ComplaintRoutingProcessor],
  controllers: [ComplaintsController],
  exports: [ComplaintsService],
})
export class ComplaintsModule {}
