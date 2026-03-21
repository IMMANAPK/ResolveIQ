import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { SettingsModule } from './modules/settings/settings.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { EmailModule } from './modules/email/email.module';
import { EscalationModule } from './modules/escalation/escalation.module';
import { AiModule } from './modules/ai/ai.module';
import { GatewayModule } from './modules/gateway/gateway.module';
import { CommitteesModule } from './modules/committees/committees.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { CommentsModule } from './modules/comments/comments.module';
import { databaseConfig } from './config/database.config';
import { redisConfig } from './config/redis.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(databaseConfig()),
    BullModule.forRoot({ redis: redisConfig() }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    ComplaintsModule,
    NotificationsModule,
    EmailModule,
    EscalationModule,
    AiModule,
    GatewayModule,
    CommitteesModule,
    EventEmitterModule.forRoot(),
    WorkflowsModule,
    SettingsModule,
    FeedbackModule,
    AttachmentsModule,
    CommentsModule,
  ],
})
export class AppModule {}
