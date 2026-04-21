import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationRule, RuleCondition } from './entities/notification-rule.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class NotificationRulesService {
  constructor(
    @InjectRepository(NotificationRule)
    private readonly ruleRepo: Repository<NotificationRule>,
    private readonly usersService: UsersService,
  ) {}

  findByCommittee(committeeId: string) {
    return this.ruleRepo.find({ where: { committeeId }, order: { order: 'ASC' } });
  }

  create(data: Partial<NotificationRule>) {
    return this.ruleRepo.save(this.ruleRepo.create(data));
  }

  async update(id: string, data: Partial<NotificationRule>) {
    await this.ruleRepo.update(id, data);
    return this.ruleRepo.findOneBy({ id });
  }

  remove(id: string) {
    return this.ruleRepo.delete(id);
  }

  /** Evaluate rules against a complaint and return deduplicated recipient user IDs */
  async resolveRecipients(
    committeeId: string,
    complaint: { priority: string; category: string },
  ): Promise<string[]> {
    const rules = await this.findByCommittee(committeeId);
    if (!rules.length) return [];

    // Determine which rules pass their condition filter
    const passingRules = rules.filter((rule) => {
      if (rule.type === 'conditional' && rule.condition) {
        return this.matchesCondition(rule.condition, complaint);
      }
      return true; // default rules always apply
    });

    // Fetch all users ONCE (N+1 fix) if any passing rule needs role expansion
    const needsRoleExpansion = passingRules.some((r) => r.recipientRoles?.length > 0);
    const allUsers = needsRoleExpansion ? await this.usersService.findAll() : [];

    const userIdSet = new Set<string>();
    for (const rule of passingRules) {
      rule.recipientUserIds?.forEach((id) => userIdSet.add(id));

      if (rule.recipientRoles?.length > 0) {
        for (const user of allUsers) {
          if (user.roles?.some((r) => rule.recipientRoles.includes(r as any))) {
            // For committee_member role, only include users assigned to this committee
            if (rule.recipientRoles.includes('committee_member' as any) && user.roles?.includes('committee_member' as any)) {
              if (user.committeeId === committeeId) userIdSet.add(user.id);
            } else {
              userIdSet.add(user.id);
            }
          }
        }
      }
    }

    return Array.from(userIdSet);
  }

  private matchesCondition(
    condition: RuleCondition,
    complaint: { priority: string; category: string },
  ): boolean {
    const fieldValue = complaint[condition.field];
    if (condition.op === 'eq') return fieldValue === condition.value;
    if (condition.op === 'neq') return fieldValue !== condition.value;
    return false;
  }
}
