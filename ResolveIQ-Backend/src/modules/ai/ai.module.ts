import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { CommitteesModule } from '../committees/committees.module';

@Module({
  imports: [CommitteesModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
