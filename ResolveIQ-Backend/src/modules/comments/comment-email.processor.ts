import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Job } from 'bull';
import { ComplaintComment } from './comment.entity';
import { Complaint } from '../complaints/entities/complaint.entity';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';
import { CommitteesService } from '../committees/committees.service';
import { UserRole } from '../users/entities/user.entity';

const PRIVILEGED = [UserRole.ADMIN, UserRole.MANAGER, UserRole.COMMITTEE_MEMBER];

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

@Processor('comments-email')
export class CommentEmailProcessor {
  private readonly logger = new Logger(CommentEmailProcessor.name);

  constructor(
    @InjectRepository(ComplaintComment)
    private readonly commentRepo: Repository<ComplaintComment>,
    @InjectRepository(Complaint)
    private readonly complaintRepo: Repository<Complaint>,
    private readonly emailService: EmailService,
    private readonly usersService: UsersService,
    private readonly committeesService: CommitteesService,
  ) {}

  @Process('comment-notify')
  async handleCommentNotify(job: Job<{ complaintId: string; commentId: string; isInternal: boolean; authorIsPrivileged: boolean }>) {
    const { complaintId, commentId, isInternal, authorIsPrivileged } = job.data;

    // Never email for internal notes
    if (isInternal) return;

    const comment = await this.commentRepo.findOne({
      where: { id: commentId },
    });
    if (!comment) return;

    const complaint = await this.complaintRepo.findOne({
      where: { id: complaintId },
      relations: ['raisedBy'],
    });
    if (!complaint) return;

    if (authorIsPrivileged) {
      // Committee → complainant
      if (!complaint.raisedBy?.email) return;
      await this.emailService.sendEmail({
        to: complaint.raisedBy.email,
        subject: `Update on your complaint: ${esc(complaint.title)}`,
        html: `<p>Hi ${esc(complaint.raisedBy.fullName)},</p>
               <p>A team member has replied to your complaint <strong>${esc(complaint.title)}</strong>:</p>
               <blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#555">
                 ${esc(comment.body)}
               </blockquote>
               <p>Log in to view the full thread.</p>`,
      });
    } else {
      // Complainant → committee
      // Debounce is handled at the Bull job level via jobId in CommentsService.
      // If this job runs, the debounce window has passed — just send.
      // Committee has no members relation; users have committeeId FK — use getMembersByCommitteeId
      const recipients: string[] = [];
      if (complaint.committeeId) {
        const members = await this.usersService.getMembersByCommitteeId(complaint.committeeId);
        members.forEach(m => m.email && recipients.push(m.email));
        const committee = await this.committeesService.findById(complaint.committeeId);
        if (committee?.manager?.email) recipients.push(committee.manager.email);
      } else {
        const managers = await this.usersService.getManagers();
        managers.forEach(m => m.email && recipients.push(m.email));
      }

      for (const email of [...new Set(recipients)]) {
        await this.emailService.sendEmail({
          to: email,
          subject: `Complainant replied: ${esc(complaint.title)}`,
          html: `<p>The complainant has posted a new message on complaint <strong>${esc(complaint.title)}</strong>:</p>
                 <blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#555">
                   ${esc(comment.body)}
                 </blockquote>`,
        }).catch(e => this.logger.error(`Failed to send to ${email}: ${e}`));
      }
    }
  }
}
