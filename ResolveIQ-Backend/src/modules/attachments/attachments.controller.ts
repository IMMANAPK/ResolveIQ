import {
  Controller, Get, Post, Delete, Param, ParseUUIDPipe,
  UseGuards, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AttachmentsService } from './attachments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const ALLOWED_MIME = [
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

@Controller('complaints/:complaintId/attachments')
@UseGuards(JwtAuthGuard)
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get()
  findAll(@Param('complaintId', ParseUUIDPipe) complaintId: string) {
    return this.attachmentsService.findByComplaint(complaintId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_MIME.includes(file.mimetype)) cb(new BadRequestException('Invalid file type'), false);
      else cb(null, true);
    },
  }))
  upload(
    @Param('complaintId', ParseUUIDPipe) complaintId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { id: string; roles?: string[] },
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.attachmentsService.upload(complaintId, user.id, user.roles ?? [], file);
  }

  @Delete(':id')
  delete(
    @Param('complaintId', ParseUUIDPipe) complaintId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; roles?: string[] },
  ) {
    return this.attachmentsService.delete(id, complaintId, user.id, user.roles ?? []);
  }
}
