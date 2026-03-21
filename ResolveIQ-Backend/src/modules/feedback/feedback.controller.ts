import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('complaints/:complaintId/feedback')
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  create(
    @Param('complaintId') complaintId: string,
    @Body() dto: CreateFeedbackDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.feedbackService.create(complaintId, user.id, dto);
  }

  @Get()
  findOne(@Param('complaintId') complaintId: string) {
    return this.feedbackService.findByComplaint(complaintId);
  }
}
