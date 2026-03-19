import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { NotificationRulesService } from './notification-rules.service';

@Controller('committees/:committeeId/notification-rules')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class NotificationRulesController {
  constructor(private readonly rulesService: NotificationRulesService) {}

  @Get()
  findAll(@Param('committeeId') committeeId: string) {
    return this.rulesService.findByCommittee(committeeId);
  }

  @Post()
  create(@Param('committeeId') committeeId: string, @Body() body: any) {
    return this.rulesService.create({ ...body, committeeId });
  }

  @Patch(':ruleId')
  update(@Param('ruleId') ruleId: string, @Body() body: any) {
    return this.rulesService.update(ruleId, body);
  }

  @Delete(':ruleId')
  remove(@Param('ruleId') ruleId: string) {
    return this.rulesService.remove(ruleId);
  }
}
