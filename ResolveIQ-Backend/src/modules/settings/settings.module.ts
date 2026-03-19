import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemSetting } from './entities/setting.entity';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { AiModule } from '../ai/ai.module';
import { EmailModule } from '../email/email.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([SystemSetting]),
    AiModule,
    EmailModule
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
