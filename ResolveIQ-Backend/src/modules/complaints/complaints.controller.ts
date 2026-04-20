import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ComplaintsService } from './complaints.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ComplaintStatus } from './entities/complaint.entity';

const PRIVILEGED_ROLES = ['admin', 'manager', 'committee_member'];

@Controller('complaints')
@UseGuards(JwtAuthGuard)
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Post()
  create(@Body() dto: CreateComplaintDto, @CurrentUser() user: { id: string }) {
    return this.complaintsService.createAndNotify({ ...dto, raisedById: user.id });
  }

  /**
   * Admin / manager / committee_member  → all complaints (optionally filtered by status)
   * Complainant                         → only their own complaints
   */
  @Get()
  findAll(
    @CurrentUser() user: { id: string; roles?: string[] },
    @Query('status') status?: ComplaintStatus,
  ) {
    const roles: string[] = user.roles ?? [];
    const isPrivileged = roles.some((r) => PRIVILEGED_ROLES.includes(r));

    if (isPrivileged) {
      return this.complaintsService.findAll(status ? { status } : undefined);
    }
    // Complainant — return only their own
    return this.complaintsService.findByUser(user.id);
  }

  @Get('my')
  findMine(@CurrentUser() user: { id: string }) {
    return this.complaintsService.findByUser(user.id);
  }

  /**
   * View a single complaint — complainants can only view their own.
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; roles?: string[] },
  ) {
    const complaint = await this.complaintsService.findOrFail(id);
    const roles: string[] = user.roles ?? [];
    const isPrivileged = roles.some((r) => PRIVILEGED_ROLES.includes(r));
    if (!isPrivileged && complaint.raisedById !== user.id) {
      throw new ForbiddenException('You are not allowed to view this complaint');
    }
    return complaint;
  }

  @Patch(':id/status')
  @Roles('admin', 'manager', 'committee_member')
  @UseGuards(RolesGuard)
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: ComplaintStatus; resolutionNotes?: string },
  ) {
    return this.complaintsService.updateStatus(id, body.status, body.resolutionNotes);
  }
}
