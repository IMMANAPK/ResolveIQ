import {
  Injectable, Logger, NotFoundException,
  ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ComplaintComment } from './comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Complaint, ComplaintStatus } from '../complaints/entities/complaint.entity';

const PRIVILEGED = ['admin', 'manager', 'committee_member'];

export interface CommentAuthor {
  id: string;
  roles?: string[];
  committeeId?: string;
}

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    @InjectRepository(ComplaintComment)
    private readonly repo: Repository<ComplaintComment>,
    @InjectRepository(Complaint)
    private readonly complaintRepo: Repository<Complaint>,
    @InjectQueue('comments-email')
    private readonly emailQueue: Queue,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private isPrivileged(roles: string[]): boolean {
    return roles.some(r => PRIVILEGED.includes(r));
  }

  async findByComplaint(
    complaintId: string,
    user: CommentAuthor,
    page = 1,
    limit = 20,
  ) {
    const complaint = await this.complaintRepo.findOne({ where: { id: complaintId } });
    if (!complaint) throw new NotFoundException('Complaint not found');

    const privileged = this.isPrivileged(user.roles ?? []);
    if (!privileged && complaint.raisedById !== user.id) {
      throw new ForbiddenException('Access denied');
    }

    const qb = this.repo
      .createQueryBuilder('c')
      .withDeleted()
      .leftJoinAndSelect('c.author', 'author')
      .where('c.complaintId = :complaintId', { complaintId })
      .orderBy('c.createdAt', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (!privileged) {
      qb.andWhere('c.isInternal = false');
    }

    const [data, total] = await qb.getManyAndCount();

    // Redact soft-deleted
    const redacted = data.map(c => {
      if (c.deletedAt) {
        c.body = '[deleted]';
        c.authorId = null as any;
        c.authorRole = null as any;
        c.author = null as any;
      }
      return c;
    });

    return { data: redacted, total, page, limit };
  }

  async create(
    complaintId: string,
    dto: CreateCommentDto,
    user: CommentAuthor,
  ): Promise<ComplaintComment> {
    const complaint = await this.complaintRepo.findOne({
      where: { id: complaintId },
      relations: ['raisedBy'],
    });
    if (!complaint) throw new NotFoundException('Complaint not found');

    const privileged = this.isPrivileged(user.roles ?? []);
    if (!privileged && complaint.raisedById !== user.id) {
      throw new ForbiddenException('Access denied');
    }
    if (dto.isInternal && !privileged) {
      throw new ForbiddenException('Only privileged users can post internal notes');
    }
    // Committee member must belong to the complaint's committee
    if (
      user.roles?.includes('committee_member') &&
      !user.roles?.includes('admin') &&
      !user.roles?.includes('manager') &&
      complaint.committeeId &&
      user.committeeId !== complaint.committeeId
    ) {
      throw new ForbiddenException('You are not assigned to this complaint\'s committee');
    }
    if (complaint.status === ComplaintStatus.CLOSED) {
      throw new BadRequestException('Complaint is closed');
    }

    const primaryRole = (user.roles ?? []).find(r => PRIVILEGED.includes(r)) ?? 'employee';
    const comment = this.repo.create({
      complaintId,
      authorId: user.id,
      body: dto.body,
      isInternal: dto.isInternal ?? false,
      authorRole: primaryRole,
    });
    const saved = await this.repo.save(comment);

    // WebSocket — no isInternal in payload
    this.eventEmitter.emit('complaint.comment.added', { complaintId });

    // Email (fire-and-forget).
    // Use Bull jobId deduplication ONLY for complainant→committee emails (debounce 5-min window).
    // Committee→complainant emails are NOT debounced (every reply should reach the complainant).
    const authorIsPrivileged = this.isPrivileged(user.roles ?? []);
    const jobId = (!authorIsPrivileged && !saved.isInternal)
      ? `complainant-reply:${complaintId}:${Math.floor(Date.now() / 300_000)}`
      : undefined;
    this.emailQueue
      .add(
        'comment-notify',
        { complaintId, commentId: saved.id, isInternal: saved.isInternal, authorIsPrivileged },
        { jobId },
      )
      .catch(e => this.logger.error('Failed to queue comment email', e));

    return saved;
  }

  async delete(
    complaintId: string,
    commentId: string,
    user: CommentAuthor,
  ): Promise<void> {
    const comment = await this.repo.findOne({ where: { id: commentId, complaintId } });
    if (!comment) throw new NotFoundException('Comment not found');

    const isAdmin = user.roles?.includes('admin');
    if (!isAdmin && comment.authorId !== user.id) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.repo.softDelete(commentId);
  }
}
