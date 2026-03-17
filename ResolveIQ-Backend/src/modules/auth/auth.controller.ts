import { Controller, Post, Body } from '@nestjs/common';
import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { AuthService } from './auth.service';
import { UserRole } from '../users/entities/user.entity';

class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
}

class RegisterDto {
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
  @IsString() fullName: string;
  @IsEnum(UserRole) @IsOptional() role?: UserRole;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register({
      email: dto.email,
      password: dto.password,
      fullName: dto.fullName,
      role: dto.role ?? UserRole.COMPLAINANT,
    });
  }
}
