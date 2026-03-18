import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './modules/users/users.service';
import { UserRole } from './modules/users/entities/user.entity';

const ADMIN_PASS = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';
const DEFAULT_PASS = process.env.SEED_DEFAULT_PASSWORD ?? 'Welcome@123';

const SEED_USERS = [
  {
    email: 'admin@resolveiq.com',
    password: ADMIN_PASS,
    fullName: 'System Admin',
    roles: [UserRole.ADMIN],
  },
  {
    email: 'immanuel53347+manager@gmail.com',
    password: DEFAULT_PASS,
    fullName: 'Immanuel',
    roles: [UserRole.MANAGER],
  },
  {
    email: 'immanuel53347+womens@gmail.com',
    password: DEFAULT_PASS,
    fullName: 'Priya Sharma',
    roles: [UserRole.COMMITTEE_MEMBER],
    department: "Womens Safety Committee",
  },
  {
    email: 'immanuel53347+cleaning@gmail.com',
    password: DEFAULT_PASS,
    fullName: 'Kumar Raj',
    roles: [UserRole.COMMITTEE_MEMBER],
    department: 'Cleaning Committee',
  },
  {
    email: 'immanuel53347+general@gmail.com',
    password: DEFAULT_PASS,
    fullName: 'Anand Kumar',
    roles: [UserRole.COMMITTEE_MEMBER],
    department: 'General Committee',
  },
  {
    email: 'immanuel53347+food@gmail.com',
    password: DEFAULT_PASS,
    fullName: 'Meena Devi',
    roles: [UserRole.COMMITTEE_MEMBER],
    department: 'Food Committee',
  },
  {
    email: 'immanuel53347+complainant@gmail.com',
    password: DEFAULT_PASS,
    fullName: 'Arun Complainant',
    roles: [UserRole.COMPLAINANT],
  },
  {
    email: 'immanuel53347+complainant2@gmail.com',
    password: DEFAULT_PASS,
    fullName: 'Siva Dual',
    roles: [UserRole.COMPLAINANT, UserRole.COMMITTEE_MEMBER],
    department: 'General Committee',
  },
];

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });

  const usersService = app.get(UsersService);
  console.log('\n🌱 Seeding users...\n');

  for (const u of SEED_USERS) {
    try {
      await usersService.createUser(u);
      console.log(`  ✅ Created: ${u.email} [${u.roles.join(', ')}]`);
    } catch (e: any) {
      if (e?.message?.includes('already registered')) {
        console.log(`  ⚠️  Skipped: ${u.email} (already exists)`);
      } else {
        console.error(`  ❌ Failed:  ${u.email} — ${e.message}`);
      }
    }
  }

  console.log('\n✅ Seed complete!\n');
  await app.close();
}

bootstrap();
