import {
  Injectable, Logger, NotFoundException,
  ForbiddenException, BadRequestException, InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v2 as cloudinary } from 'cloudinary';
import { Attachment } from './attachment.entity';
import { Complaint } from '../complaints/entities/complaint.entity';

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    @InjectRepository(Attachment)
    private readonly repo: Repository<Attachment>,
    @InjectRepository(Complaint)
    private readonly complaintRepo: Repository<Complaint>,
  ) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  findByComplaint(complaintId: string): Promise<Attachment[]> {
    return this.repo.find({ where: { complaintId }, order: { createdAt: 'ASC' } });
  }

  async upload(
    complaintId: string,
    userId: string,
    userRoles: string[],
    file: Express.Multer.File,
  ): Promise<Attachment> {
    const complaint = await this.complaintRepo.findOne({ where: { id: complaintId } });
    if (!complaint) throw new NotFoundException('Complaint not found');

    const isPrivileged = userRoles.some(r => ['admin', 'manager', 'committee_member'].includes(r));
    if (!isPrivileged && complaint.raisedById !== userId) {
      throw new ForbiddenException('You can only attach files to your own complaints');
    }

    const count = await this.repo.count({ where: { complaintId } });
    if (count >= 3) throw new BadRequestException('Maximum 3 attachments per complaint');

    const { url, publicId, resourceType } = await this.uploadToCloudinary(file);

    try {
      const attachment = this.repo.create({
        complaintId,
        uploadedById: userId,
        url,
        publicId,
        resourceType,
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      });
      return await this.repo.save(attachment);
    } catch (err) {
      this.logger.error(`DB save failed, cleaning up Cloudinary: ${publicId}`);
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType as any })
        .catch(e => this.logger.error(`Cloudinary cleanup failed: ${e}`));
      throw new InternalServerErrorException('Failed to save attachment');
    }
  }

  async delete(attachmentId: string, complaintId: string, userId: string, userRoles: string[]): Promise<void> {
    const attachment = await this.repo.findOne({ where: { id: attachmentId } });
    if (!attachment || attachment.complaintId !== complaintId) {
      throw new NotFoundException('Attachment not found');
    }

    const isAdmin = userRoles.includes('admin');
    if (!isAdmin && attachment.uploadedById !== userId) {
      throw new ForbiddenException('You can only delete your own attachments');
    }

    await cloudinary.uploader.destroy(attachment.publicId, {
      resource_type: attachment.resourceType as any,
    }).catch(e => this.logger.error(`Cloudinary delete failed: ${e}`));

    await this.repo.delete(attachmentId);
  }

  private uploadToCloudinary(file: Express.Multer.File): Promise<{ url: string; publicId: string; resourceType: string }> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'resolveiq/complaints', resource_type: 'auto' },
        (err, result) => {
          if (err || !result) return reject(err ?? new Error('No result from Cloudinary'));
          resolve({ url: result.secure_url, publicId: result.public_id, resourceType: result.resource_type });
        },
      );
      stream.end(file.buffer);
    });
  }
}
