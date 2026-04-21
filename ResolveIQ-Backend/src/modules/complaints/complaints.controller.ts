import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { ComplaintsService } from './complaints.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ComplaintStatus } from './entities/complaint.entity';
import { WorkflowEngineService } from '../workflows/workflow-engine.service';

const PRIVILEGED_ROLES = ['admin', 'manager', 'committee_member'];

@Controller('complaints')
@UseGuards(JwtAuthGuard)
export class ComplaintsController {
  constructor(
    private readonly complaintsService: ComplaintsService,
    @Inject(forwardRef(() => WorkflowEngineService))
    private readonly engineService: WorkflowEngineService,
  ) {}

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

  @Get('stats')
  getStats(
    @CurrentUser() user: { id: string; roles?: string[] },
    @Query('days') days?: string,
  ) {
    const roles: string[] = user.roles ?? [];
    const isPrivileged = roles.some((r) => PRIVILEGED_ROLES.includes(r));
    if (!isPrivileged) {
      throw new ForbiddenException('Only privileged users can access stats');
    }
    const numDays = days ? parseInt(days, 10) : 30;
    return this.complaintsService.getStats(numDays);
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
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: ComplaintStatus; resolutionNotes?: string; notifyComplainant?: boolean },
    @CurrentUser() user: { id: string; roles?: string[]; fullName?: string; email?: string },
  ) {
    const roles: string[] = user.roles ?? [];
    const isPrivileged = roles.some(r => PRIVILEGED_ROLES.includes(r));
    if (!isPrivileged) {
      throw new ForbiddenException('Only privileged users can update complaint status');
    }
    const autoNotify = body.status === ComplaintStatus.RESOLVED || body.status === ComplaintStatus.CLOSED;
    const notify = body.notifyComplainant ?? autoNotify;
    return this.complaintsService.updateStatus(id, body.status, body.resolutionNotes, notify, user);
  }

  @Get(':id/workflow-runs')
  async getWorkflowRuns(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; roles?: string[] },
  ) {
    // Check permission - reuse findOne permission logic
    await this.findOne(id, user); 
    return this.engineService.getRunsForComplaint(id);
  }

  @Post(':id/regenerate-summary')
  async regenerateSummary(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; roles?: string[] },
  ) {
    const roles: string[] = user.roles ?? [];
    const isPrivileged = roles.some((r) => PRIVILEGED_ROLES.includes(r));
    if (!isPrivileged) {
      throw new ForbiddenException('Only privileged users can regenerate summaries');
    }
    
    await this.complaintsService.regenerateSummary(id);
    return { message: 'Summary regeneration queued' };
  }
}
