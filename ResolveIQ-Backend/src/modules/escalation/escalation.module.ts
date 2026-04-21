import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { EscalationService } from './escalation.service';
import { EscalationProcessor, ESCALATION_QUEUE } from './escalation.processor';
import { EscalationSchedulerService } from './escalation-scheduler.service';
import { EscalationController } from './escalation.controller';
import { EscalationLog } from './entities/escalation-log.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { AiModule } from '../ai/ai.module';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { GatewayModule } from '../gateway/gateway.module';
import { EMAIL_QUEUE } from '../email/email.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([EscalationLog]),
    BullModule.registerQueue({ name: ESCALATION_QUEUE }),
    BullModule.registerQueue({ name: EMAIL_QUEUE }),
    ScheduleModule.forRoot(),
    NotificationsModule,
    AiModule,
    EmailModule,
    UsersModule,
    GatewayModule,
  ],
  providers: [EscalationService, EscalationProcessor, EscalationSchedulerService],
  controllers: [EscalationController],
  exports: [EscalationService, EscalationSchedulerService],
})
export class EscalationModule {}
