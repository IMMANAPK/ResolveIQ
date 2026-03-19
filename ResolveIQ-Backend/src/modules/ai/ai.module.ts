import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { CommitteesModule } from '../committees/committees.module';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiSummaryProcessor } from './ai-summary.processor';
import { GatewayModule } from '../gateway/gateway.module';
import { Complaint } from '../complaints/entities/complaint.entity';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'ai-summary' }),
    BullModule.registerQueue({ name: 'complaint-routing' }),
    TypeOrmModule.forFeature([Complaint]),
    CommitteesModule,
    GatewayModule,
  ],
  providers: [AiService, AiSummaryProcessor],
  exports: [AiService, BullModule],
})
export class AiModule {}
