import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { WorkflowDefinition } from './entities/workflow-definition.entity';
import { WorkflowRun } from './entities/workflow-run.entity';
import { WorkflowStepLog } from './entities/workflow-step-log.entity';
import { Complaint } from '../complaints/entities/complaint.entity';
import { WorkflowsService } from './workflows.service';
import { WorkflowsController } from './workflows.controller';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowStepProcessor } from './workflow-step.processor';
import { WorkflowTimeoutService } from './workflow-timeout.service';
import { AiModule } from '../ai/ai.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
import { ComplaintsModule } from '../complaints/complaints.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkflowDefinition, WorkflowRun, WorkflowStepLog, Complaint]),
    BullModule.registerQueue({ name: 'workflow-steps' }),
    AiModule,
    NotificationsModule,
    EmailModule,
    ComplaintsModule,
    UsersModule,
  ],
  controllers: [WorkflowsController],
  providers: [
    WorkflowsService,
    WorkflowEngineService,
    WorkflowStepProcessor,
    WorkflowTimeoutService,
  ],
  exports: [WorkflowEngineService],
})
export class WorkflowsModule {}
