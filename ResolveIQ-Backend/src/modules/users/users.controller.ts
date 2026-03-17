import { Controller, Get, Post, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from './entities/user.entity';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.createUser(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.usersService.findAll();
  }

  @Get('committee')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  getCommittee() {
    return this.usersService.getCommitteeMembers();
  }

  @Get('committee/available')
  getAvailableCommittee() {
    return this.usersService.getAvailableCommitteeMembers();
  }

  @Patch(':id/availability')
  @Roles(UserRole.ADMIN, UserRole.COMMITTEE_MEMBER)
  updateAvailability(
    @Param('id') id: string,
    @Body() body: { isAvailable: boolean; unavailableUntil?: string },
  ) {
    return this.usersService.updateAvailability(
      id,
      body.isAvailable,
      body.unavailableUntil ? new Date(body.unavailableUntil) : undefined,
    );
  }
}
