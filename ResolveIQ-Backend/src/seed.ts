import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './modules/users/users.service';
import { UserRole } from './modules/users/entities/user.entity';
import { CommitteesService } from './modules/committees/committees.service';
import { ComplaintCategory } from './modules/complaints/entities/complaint.entity';

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
    email: 'immanuel53447+manager@gmail.com',
    password: DEFAULT_PASS,
    fullName: 'Immanuel',
    roles: [UserRole.MANAGER],
  },
  {
    email: 'immanuel53447+womens@gmail.com',
    password: DEFAULT_PASS,
    fullName: 'Priya Sharma',
    roles: [UserRole.COMMITTEE_MEMBER],
    department: "Womens Safety Committee",
  },
  {
    email: 'immanuel53447+cleaning@gmail.com',
    password: DEFAULT_PASS,
    fullName: 'Kumar Raj',
    roles: [UserRole.COMMITTEE_MEMBER],
    department: 'Cleaning Committee',
  },
  {
    email: 'immanuel53447+general@gmail.com',
    password: DEFAULT_PASS,
    fullName: 'Anand Kumar',
    roles: [UserRole.COMMITTEE_MEMBER],
    department: 'General Committee',
  },
  {
    email: 'immanuel53447+food@gmail.com',
    password: DEFAULT_PASS,
    fullName: 'Meena Devi',
    roles: [UserRole.COMMITTEE_MEMBER],
    department: 'Food Committee',
  },
  {
    email: 'immanuel53447+complainant@gmail.com',
    password: DEFAULT_PASS,
    fullName: 'Arun Complainant',
    roles: [UserRole.COMPLAINANT],
  },
  {
    email: 'immanuel53447+complainant2@gmail.com',
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
  const committeesService = app.get(CommitteesService);

  // ── Seed Users ────────────────────────────────────────────────────────────
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

  // ── Seed Committees ───────────────────────────────────────────────────────
  console.log('\n🏢 Seeding committees...\n');

  // Get manager user (to assign as committee manager)
  const manager = await usersService.findByEmail('immanuel53447+manager@gmail.com');

  const SEED_COMMITTEES = [
    {
      name: "Womens Safety Committee",
      description: 'Handles workplace harassment, gender discrimination, personal safety, and sexual misconduct',
      categories: [ComplaintCategory.SAFETY, ComplaintCategory.CONDUCT],
      managerId: manager?.id,
    },
    {
      name: 'Cleaning Committee',
      description: 'Handles cleanliness, hygiene, sanitation, waste, pest control',
      categories: [ComplaintCategory.FACILITIES],
      managerId: manager?.id,
    },
    {
      name: 'General Committee',
      description: 'Handles IT issues, HR, payroll, leave, general office issues, and anything not covered by other committees',
      categories: [ComplaintCategory.IT, ComplaintCategory.HR, ComplaintCategory.OTHER],
      managerId: manager?.id,
    },
    {
      name: 'Food Committee',
      description: 'Handles cafeteria, food quality, canteen, meals, catering, drinking water, vending machines',
      categories: [] as ComplaintCategory[],
      managerId: manager?.id,
    },
  ];

  for (const c of SEED_COMMITTEES) {
    try {
      const existing = await committeesService.findAll();
      if (existing.some((e) => e.name === c.name)) {
        console.log(`  ⚠️  Skipped: ${c.name} (already exists)`);
        continue;
      }
      await committeesService.create(c);
      console.log(`  ✅ Created: ${c.name} [${c.categories.join(', ') || 'no category mapping'}]`);
    } catch (e: any) {
      console.error(`  ❌ Failed:  ${c.name} — ${e.message}`);
    }
  }

  console.log('\n✅ Seed complete!\n');
  await app.close();
}

bootstrap();
