import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './modules/users/users.service';
import { UserRole } from './modules/users/entities/user.entity';
import { CommitteesService } from './modules/committees/committees.service';
import { ComplaintCategory } from './modules/complaints/entities/complaint.entity';
import { WorkflowsService } from './modules/workflows/workflows.service';

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

// ── Workflow seed definitions ──────────────────────────────────────────────

const SEED_WORKFLOWS = [
  {
    name: 'Auto-Summarize on Complaint Created',
    description:
      'When a complaint is submitted, run AI summarization and store the result in the workflow context.',
    trigger: { type: 'event' as const, event: 'complaint.created' },
    isActive: true,
    definition: {
      schemaVersion: 1,
      nodes: [
        { id: 'n1', type: 'trigger', config: { event: 'complaint.created' } },
        {
          id: 'n2',
          type: 'ai_prompt',
          config: { promptSlug: 'summarize', outputVar: 'ai_summary' },
        },
      ],
      edges: [{ id: 'e1', from: 'n1', to: 'n2' }],
    },
  },
  {
    name: 'High-Priority Alert Workflow',
    description:
      'When a complaint is created, summarize it with AI, then branch on priority. ' +
      'High-priority complaints trigger an immediate manager notification; others are skipped.',
    trigger: { type: 'event' as const, event: 'complaint.created' },
    isActive: true,
    definition: {
      schemaVersion: 1,
      nodes: [
        { id: 'n1', type: 'trigger', config: { event: 'complaint.created' } },
        {
          id: 'n2',
          type: 'ai_prompt',
          config: { promptSlug: 'summarize', outputVar: 'ai_summary' },
        },
        {
          id: 'n3',
          type: 'condition',
          config: { field: 'priority', op: 'eq', value: 'high' },
        },
        {
          id: 'n4',
          type: 'action',
          config: {
            actionType: 'send_notification',
            recipientRoles: ['manager', 'admin'],
            title: 'High-Priority Complaint Requires Attention',
            message:
              'A high-priority complaint has been submitted and needs immediate review.',
          },
        },
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2' },
        { id: 'e2', from: 'n2', to: 'n3' },
        { id: 'e3', from: 'n3', to: 'n4', condition: 'true' },
      ],
    },
  },
  {
    name: 'Escalation Email Notification',
    description:
      'When a complaint is escalated, send an email to all managers and admins notifying them.',
    trigger: { type: 'event' as const, event: 'complaint.escalated' },
    isActive: true,
    definition: {
      schemaVersion: 1,
      nodes: [
        { id: 'n1', type: 'trigger', config: { event: 'complaint.escalated' } },
        {
          id: 'n2',
          type: 'action',
          config: {
            actionType: 'send_email',
            recipientRoles: ['manager', 'admin'],
            subject: 'Complaint Escalated – Immediate Action Required',
            body:
              '<p>A complaint has been escalated and requires your immediate attention. ' +
              'Please log in to ResolveIQ to review and take appropriate action.</p>',
          },
        },
      ],
      edges: [{ id: 'e1', from: 'n1', to: 'n2' }],
    },
  },
  {
    name: 'Manual Review Workflow',
    description:
      'Manually triggered workflow to re-summarize a complaint with AI and update its priority to high.',
    trigger: { type: 'manual' as const },
    isActive: true,
    definition: {
      schemaVersion: 1,
      nodes: [
        { id: 'n1', type: 'trigger', config: {} },
        {
          id: 'n2',
          type: 'ai_prompt',
          config: { promptSlug: 'summarize', outputVar: 'ai_summary' },
        },
        {
          id: 'n3',
          type: 'action',
          config: {
            actionType: 'update_complaint',
            field: 'priority',
            value: 'high',
          },
        },
        {
          id: 'n4',
          type: 'action',
          config: {
            actionType: 'send_notification',
            recipientRoles: ['manager'],
            title: 'Manual Review Complete',
            message: 'Manual review workflow has completed. Complaint priority set to high.',
          },
        },
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2' },
        { id: 'e2', from: 'n2', to: 'n3' },
        { id: 'e3', from: 'n3', to: 'n4' },
      ],
    },
  },
  {
    name: 'Delayed Follow-Up Reminder',
    description:
      'After a complaint is created, wait 24 hours then notify the assigned committee members ' +
      'if the complaint is still unresolved.',
    trigger: { type: 'event' as const, event: 'complaint.created' },
    isActive: false,
    definition: {
      schemaVersion: 1,
      nodes: [
        { id: 'n1', type: 'trigger', config: { event: 'complaint.created' } },
        {
          id: 'n2',
          type: 'delay',
          config: { delayMs: 86400000 }, // 24 hours
        },
        {
          id: 'n3',
          type: 'action',
          config: {
            actionType: 'send_notification',
            recipientRoles: ['committee_member', 'manager'],
            title: '24-Hour Follow-Up: Complaint Pending',
            message:
              'A complaint submitted 24 hours ago may still be awaiting resolution. Please review.',
          },
        },
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2' },
        { id: 'e2', from: 'n2', to: 'n3' },
      ],
    },
  },
];

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });

  const usersService = app.get(UsersService);
  const committeesService = app.get(CommitteesService);
  const workflowsService = app.get(WorkflowsService);

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

  // ── Seed Workflows ────────────────────────────────────────────────────────
  console.log('\n⚡ Seeding workflows...\n');

  const existingWorkflows = await workflowsService.findAll();

  for (const w of SEED_WORKFLOWS) {
    try {
      if (existingWorkflows.some((e) => e.name === w.name)) {
        console.log(`  ⚠️  Skipped: ${w.name} (already exists)`);
        continue;
      }
      await workflowsService.create(w);
      const status = w.isActive ? 'active' : 'inactive';
      console.log(`  ✅ Created: ${w.name} [${w.trigger.type}${w.trigger.event ? ` / ${w.trigger.event}` : ''}] (${status})`);
    } catch (e: any) {
      console.error(`  ❌ Failed:  ${w.name} — ${e.message}`);
    }
  }

  console.log('\n✅ Seed complete!\n');
  await app.close();
}

bootstrap();
