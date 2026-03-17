import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ComplaintsService } from './complaints.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ComplaintStatus } from './entities/complaint.entity';

@Controller('complaints')
@UseGuards(JwtAuthGuard)
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Post()
  create(@Body() dto: CreateComplaintDto, @CurrentUser() user: { id: string }) {
    return this.complaintsService.create({ ...dto, raisedById: user.id });
  }

  @Get()
  findAll(@Query('status') status?: ComplaintStatus) {
    return this.complaintsService.findAll(status ? { status } : undefined);
  }

  @Get('my')
  findMine(@CurrentUser() user: { id: string }) {
    return this.complaintsService.findByUser(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.complaintsService.findOrFail(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: ComplaintStatus; resolutionNotes?: string },
  ) {
    return this.complaintsService.updateStatus(id, body.status, body.resolutionNotes);
  }
}
