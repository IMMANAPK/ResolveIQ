import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { CommitteesService } from './committees.service';
import { CreateCommitteeDto, UpdateCommitteeDto } from './dto/committee.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('committees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommitteesController {
  constructor(private readonly committeesService: CommitteesService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  findAll() {
    return this.committeesService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  findOne(@Param('id') id: string) {
    return this.committeesService.findById(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateCommitteeDto) {
    return this.committeesService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateCommitteeDto) {
    return this.committeesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.committeesService.remove(id);
  }
}
