import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { WorkflowsService } from './workflows.service';
import { WorkflowEngineService } from './workflow-engine.service';

@Controller('admin/workflows')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class WorkflowsController {
  constructor(
    private readonly workflowsService: WorkflowsService,
    private readonly engineService: WorkflowEngineService,
  ) {}

  @Get()
  findAll() {
    return this.workflowsService.findAll();
  }

  @Post()
  create(@Body() body: any) {
    return this.workflowsService.create(body);
  }

  // IMPORTANT: specific literal-segment routes MUST come before :id routes
  // to prevent NestJS from matching e.g. "runs" as the :id parameter.

  /** GET /admin/workflows/runs/:runId — single run detail with step logs */
  @Get('runs/:runId')
  getRunById(@Param('runId') runId: string) {
    return this.workflowsService.findRunById(runId);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.workflowsService.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.workflowsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.workflowsService.remove(id);
  }

  @Post(':id/run')
  runManual(@Param('id') id: string, @Body('complaintId') complaintId: string) {
    return this.engineService.triggerManual(id, complaintId);
  }

  @Post(':id/dry-run')
  dryRun(@Param('id') id: string, @Body('complaintId') complaintId: string) {
    return this.engineService.dryRun(id, complaintId);
  }

  @Get(':id/runs')
  getRuns(@Param('id') id: string) {
    return this.engineService.getWorkflowRuns(id);
  }
}
