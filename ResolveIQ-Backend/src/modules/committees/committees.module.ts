import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Committee } from './entities/committee.entity';
import { CommitteesService } from './committees.service';
import { CommitteesController } from './committees.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Committee])],
  providers: [CommitteesService],
  controllers: [CommitteesController],
  exports: [CommitteesService],
})
export class CommitteesModule {}
