import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ComplaintComment } from './comment.entity';
import { Complaint } from '../complaints/entities/complaint.entity';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { CommentEmailProcessor } from './comment-email.processor';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { CommitteesModule } from '../committees/committees.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ComplaintComment, Complaint]),
    BullModule.registerQueue({ name: 'comments-email' }),
    EmailModule,
    UsersModule,
    CommitteesModule,
  ],
  providers: [CommentsService, CommentEmailProcessor],
  controllers: [CommentsController],
  exports: [CommentsService],
})
export class CommentsModule {}
