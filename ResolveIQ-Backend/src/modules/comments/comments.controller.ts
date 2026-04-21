import {
  Controller, Get, Post, Delete,
  Param, Body, Query, ParseUUIDPipe,
  ParseIntPipe, DefaultValuePipe, UseGuards,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('complaints/:complaintId/comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  findAll(
    @Param('complaintId', ParseUUIDPipe) complaintId: string,
    @CurrentUser() user: { id: string; roles?: string[]; committeeId?: string },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.commentsService.findByComplaint(complaintId, user, page, limit);
  }

  @Post()
  create(
    @Param('complaintId', ParseUUIDPipe) complaintId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: { id: string; roles?: string[]; committeeId?: string },
  ) {
    return this.commentsService.create(complaintId, dto, user);
  }

  @Delete(':commentId')
  delete(
    @Param('complaintId', ParseUUIDPipe) complaintId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: { id: string; roles?: string[] },
  ) {
    return this.commentsService.delete(complaintId, commentId, user);
  }
}
