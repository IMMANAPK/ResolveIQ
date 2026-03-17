import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { EmailModule } from './modules/email/email.module';
import { EscalationModule } from './modules/escalation/escalation.module';
import { AiModule } from './modules/ai/ai.module';
import { GatewayModule } from './modules/gateway/gateway.module';
import { databaseConfig } from './config/database.config';
import { redisConfig } from './config/redis.config';
import { UsersService } from './modules/users/users.service';
import { UserRole } from './modules/users/entities/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(databaseConfig()),
    BullModule.forRoot({ redis: redisConfig() }),
    AuthModule,
    UsersModule,
    ComplaintsModule,
    NotificationsModule,
    EmailModule,
    EscalationModule,
    AiModule,
    GatewayModule,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private usersService: UsersService) {}

  async onModuleInit() {
    // Seed default admin if no users exist
    const adminEmail = 'admin@resolveiq.com';
    const existingAdmin = await this.usersService.findByEmail(adminEmail);
    if (!existingAdmin) {
      console.log('Seeding default admin user...');
      await this.usersService.createUser({
        email: adminEmail,
        password: 'adminpassword',
        fullName: 'System Administrator',
        role: UserRole.ADMIN,
      });
      console.log('Default admin user created: admin@resolveiq.com / adminpassword');
    }
  }
}
