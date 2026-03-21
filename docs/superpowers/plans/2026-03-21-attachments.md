# Complaint Attachments Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow complainants and committee members to attach up to 3 files (images + documents) to complaints, stored on Cloudinary, displayed in the UI and embedded in email notifications.

**Architecture:** New `AttachmentsModule` with its own entity, service, and controller nested under `/complaints/:complaintId/attachments`. Frontend adds a dropzone to `FileComplaintDialog` and an attachment grid to `ComplaintDetail`. `ComplaintNotifierService` is extended to embed images and link documents in outgoing emails.

**Tech Stack:** NestJS + TypeORM + Cloudinary SDK + Multer (backend) · React + react-dropzone + TanStack Query v5 (frontend)

**Spec:** `docs/superpowers/specs/2026-03-21-attachments-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `ResolveIQ-Backend/src/modules/attachments/attachment.entity.ts` | Attachment DB entity |
| `ResolveIQ-Backend/src/modules/attachments/attachments.service.ts` | Upload/delete/list logic + Cloudinary calls |
| `ResolveIQ-Backend/src/modules/attachments/attachments.controller.ts` | REST endpoints nested under complaints |
| `ResolveIQ-Backend/src/modules/attachments/attachments.module.ts` | NestJS module wiring |
| `frontend/src/hooks/useAttachments.ts` | Query + mutation hooks |
| `frontend/src/components/cms/AttachmentGrid.tsx` | Display grid (thumbnails + doc cards + delete) |
| `frontend/src/components/cms/FileDropzone.tsx` | Reusable dropzone (used in dialog + detail) |

### Modified Files

| File | Changes |
|------|---------|
| `ResolveIQ-Backend/src/app.module.ts` | Import `AttachmentsModule` |
| `ResolveIQ-Backend/src/modules/complaints/complaint-notifier.service.ts` | Inject `AttachmentsService`, embed in emails |
| `ResolveIQ-Backend/src/modules/complaints/complaints.module.ts` | Import `AttachmentsModule` (for notifier) |
| `frontend/src/types/api.ts` | Add `ApiAttachment` interface |
| `frontend/src/pages/ComplaintDetail.tsx` | Add attachment section |
| `frontend/src/pages/FileComplaintDialog.tsx` (or wherever dialog lives) | Add dropzone |

---

## Chunk 1: Backend — Install deps + Entity + Cloudinary Service

### Task 1: Install backend dependencies

**Files:** `ResolveIQ-Backend/package.json`

- [ ] **Step 1: Install packages**

```bash
cd ResolveIQ-Backend
npm install cloudinary multer @types/multer
```

- [ ] **Step 2: Add env vars to `.env`**

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

- [ ] **Step 3: Verify backend still compiles**

```bash
npx tsc --noEmit
```
Expected: No errors

---

### Task 2: Create Attachment Entity

**Files:**
- Create: `ResolveIQ-Backend/src/modules/attachments/attachment.entity.ts`

- [ ] **Step 1: Write the entity**

```typescript
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Complaint } from '../complaints/entities/complaint.entity';
import { User } from '../users/entities/user.entity';

@Entity('attachments')
export class Attachment extends BaseEntity {
  @ManyToOne(() => Complaint, { onDelete: 'CASCADE' })
  @JoinColumn()
  complaint: Complaint;

  @Column()
  complaintId: string;

  @ManyToOne(() => User)
  @JoinColumn()
  uploadedBy: User;

  @Column()
  uploadedById: string;

  @Column()
  url: string; // Cloudinary secure_url

  @Column()
  publicId: string; // Cloudinary public_id

  @Column()
  resourceType: string; // 'image' or 'raw'

  @Column()
  filename: string; // original filename

  @Column()
  mimetype: string;

  @Column({ type: 'int' })
  size: number; // bytes
}
```

- [ ] **Step 2: Verify compiles**

```bash
cd ResolveIQ-Backend && npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add ResolveIQ-Backend/src/modules/attachments/attachment.entity.ts
git commit -m "feat(attachments): add Attachment entity"
```

---

### Task 3: Create AttachmentsService

**Files:**
- Create: `ResolveIQ-Backend/src/modules/attachments/attachments.service.ts`

- [ ] **Step 1: Write the service**

```typescript
import {
  Injectable, Logger, NotFoundException,
  ForbiddenException, BadRequestException, InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v2 as cloudinary } from 'cloudinary';
import { Attachment } from './attachment.entity';
import { Complaint } from '../complaints/entities/complaint.entity';

const ALLOWED_MIME = [
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

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
    // 1. Validate complaint exists
    const complaint = await this.complaintRepo.findOne({ where: { id: complaintId } });
    if (!complaint) throw new NotFoundException('Complaint not found');

    // 2. Complainant can only upload to own complaint
    const isPrivileged = userRoles.some(r => ['admin', 'manager', 'committee_member'].includes(r));
    if (!isPrivileged && complaint.raisedById !== userId) {
      throw new ForbiddenException('You can only attach files to your own complaints');
    }

    // 3. Count check BEFORE upload
    const count = await this.repo.count({ where: { complaintId } });
    if (count >= 3) throw new BadRequestException('Maximum 3 attachments per complaint');

    // 4. Upload to Cloudinary
    const { url, publicId, resourceType } = await this.uploadToCloudinary(file);

    // 5. Save record — rollback Cloudinary on failure
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
      this.logger.error(`DB save failed for attachment, cleaning up Cloudinary: ${publicId}`);
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
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            resourceType: result.resource_type,
          });
        },
      );
      stream.end(file.buffer);
    });
  }
}
```

- [ ] **Step 2: Verify compiles**

```bash
cd ResolveIQ-Backend && npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add ResolveIQ-Backend/src/modules/attachments/attachments.service.ts
git commit -m "feat(attachments): add AttachmentsService with Cloudinary upload/delete"
```

---

### Task 4: Create AttachmentsController

**Files:**
- Create: `ResolveIQ-Backend/src/modules/attachments/attachments.controller.ts`

- [ ] **Step 1: Write the controller**

```typescript
import {
  Controller, Get, Post, Delete, Param, ParseUUIDPipe,
  UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { BadRequestException } from '@nestjs/common';
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
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.includes(file.mimetype)) {
          cb(new BadRequestException('Invalid file type'), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
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
```

- [ ] **Step 2: Verify compiles**

```bash
cd ResolveIQ-Backend && npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add ResolveIQ-Backend/src/modules/attachments/attachments.controller.ts
git commit -m "feat(attachments): add AttachmentsController"
```

---

### Task 5: Create AttachmentsModule + Register in AppModule

**Files:**
- Create: `ResolveIQ-Backend/src/modules/attachments/attachments.module.ts`
- Modify: `ResolveIQ-Backend/src/app.module.ts`
- Modify: `ResolveIQ-Backend/src/modules/complaints/complaints.module.ts`

- [ ] **Step 1: Write the module**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attachment } from './attachment.entity';
import { Complaint } from '../complaints/entities/complaint.entity';
import { AttachmentsService } from './attachments.service';
import { AttachmentsController } from './attachments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Attachment, Complaint])],
  providers: [AttachmentsService],
  controllers: [AttachmentsController],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
```

- [ ] **Step 2: Register in AppModule**

Add to `ResolveIQ-Backend/src/app.module.ts`:

```typescript
import { AttachmentsModule } from './modules/attachments/attachments.module';
// add AttachmentsModule to imports array
```

- [ ] **Step 3: Import in ComplaintsModule** (needed for notifier in Chunk 3)

Add to `ResolveIQ-Backend/src/modules/complaints/complaints.module.ts`:

```typescript
import { AttachmentsModule } from '../attachments/attachments.module';
// add AttachmentsModule to imports array
```

- [ ] **Step 4: Verify compiles**

```bash
cd ResolveIQ-Backend && npx tsc --noEmit
```
Expected: No errors. TypeORM `synchronize: true` auto-creates the `attachments` table.

- [ ] **Step 5: Commit**

```bash
git add ResolveIQ-Backend/src/modules/attachments/attachments.module.ts \
        ResolveIQ-Backend/src/app.module.ts \
        ResolveIQ-Backend/src/modules/complaints/complaints.module.ts
git commit -m "feat(attachments): register AttachmentsModule in app"
```

---

## Chunk 2: Frontend — Types + Hooks + UI Components

### Task 6: Add Frontend Types

**Files:**
- Modify: `frontend/src/types/api.ts`

- [ ] **Step 1: Add ApiAttachment interface**

Add after the `ApiFeedback` interface:

```typescript
export interface ApiAttachment {
  id: string;
  complaintId: string;
  uploadedById: string;
  url: string;
  filename: string;
  mimetype: string;
  size: number;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Verify compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/api.ts
git commit -m "feat(attachments): add ApiAttachment type"
```

---

### Task 7: Create useAttachments Hook

**Files:**
- Create: `frontend/src/hooks/useAttachments.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { ApiAttachment } from "@/types/api";

export function useAttachments(complaintId: string) {
  return useQuery({
    queryKey: ["attachments", complaintId],
    queryFn: async () => {
      const { data } = await api.get<ApiAttachment[]>(
        `/complaints/${complaintId}/attachments`
      );
      return data;
    },
    enabled: !!complaintId,
  });
}

export function useUploadAttachment(complaintId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post<ApiAttachment>(
        `/complaints/${complaintId}/attachments`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attachments", complaintId] });
    },
  });
}

export function useDeleteAttachment(complaintId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (attachmentId: string) => {
      await api.delete(`/complaints/${complaintId}/attachments/${attachmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attachments", complaintId] });
    },
  });
}
```

- [ ] **Step 2: Verify compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useAttachments.ts
git commit -m "feat(attachments): add useAttachments hooks"
```

---

### Task 8: Install react-dropzone

**Files:** `frontend/package.json`

- [ ] **Step 1: Install**

```bash
cd frontend && npm install react-dropzone
```

- [ ] **Step 2: Verify compiles**

```bash
npx tsc --noEmit
```

---

### Task 9: Create FileDropzone Component

**Files:**
- Create: `frontend/src/components/cms/FileDropzone.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { useDropzone } from "react-dropzone";
import { Upload, X } from "lucide-react";

const ACCEPTED = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
};

interface FileDropzoneProps {
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

export function FileDropzone({ files, onChange, maxFiles = 3, disabled = false }: FileDropzoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPTED,
    maxFiles,
    maxSize: 10 * 1024 * 1024,
    disabled,
    onDrop: (accepted) => onChange([...files, ...accepted].slice(0, maxFiles)),
  });

  const remove = (index: number) => onChange(files.filter((_, i) => i !== index));

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <input {...getInputProps()} />
        <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {isDragActive ? "Drop files here" : "Drag & drop or click to upload"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          JPG, PNG, WEBP, PDF, DOCX, XLSX · Max 10MB · Up to {maxFiles} files
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-xs">
              <span className="truncate">{f.name}</span>
              <button type="button" onClick={() => remove(i)}>
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/cms/FileDropzone.tsx
git commit -m "feat(attachments): add FileDropzone component"
```

---

### Task 10: Create AttachmentGrid Component

**Files:**
- Create: `frontend/src/components/cms/AttachmentGrid.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { Trash2, FileText, FileSpreadsheet, File } from "lucide-react";
import type { ApiAttachment } from "@/types/api";

interface AttachmentGridProps {
  attachments: ApiAttachment[];
  currentUserId?: string;
  isAdmin?: boolean;
  onDelete?: (id: string) => void;
  deleting?: boolean;
}

function DocIcon({ mimetype }: { mimetype: string }) {
  if (mimetype.includes("spreadsheet")) return <FileSpreadsheet className="h-8 w-8 text-green-600" />;
  if (mimetype.includes("pdf")) return <FileText className="h-8 w-8 text-red-500" />;
  return <File className="h-8 w-8 text-blue-500" />;
}

export function AttachmentGrid({ attachments, currentUserId, isAdmin, onDelete, deleting }: AttachmentGridProps) {
  if (!attachments.length) return null;

  return (
    <div className="grid grid-cols-3 gap-3">
      {attachments.map((a) => {
        const isImage = a.mimetype.startsWith("image/");
        const canDelete = isAdmin || a.uploadedById === currentUserId;

        return (
          <div key={a.id} className="group relative rounded-lg border bg-muted/30 overflow-hidden">
            {isImage ? (
              <a href={a.url} target="_blank" rel="noreferrer">
                <img src={a.url} alt={a.filename} className="h-24 w-full object-cover" />
              </a>
            ) : (
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="flex h-24 flex-col items-center justify-center gap-1"
              >
                <DocIcon mimetype={a.mimetype} />
                <span className="truncate px-2 text-xs text-muted-foreground">{a.filename}</span>
              </a>
            )}

            {canDelete && onDelete && (
              <button
                onClick={() => onDelete(a.id)}
                disabled={deleting}
                className="absolute right-1 top-1 hidden rounded bg-black/60 p-1 text-white group-hover:block"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/cms/AttachmentGrid.tsx
git commit -m "feat(attachments): add AttachmentGrid component"
```

---

### Task 11: Add Attachments Section to ComplaintDetail

**Files:**
- Modify: `frontend/src/pages/ComplaintDetail.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { useAttachments, useUploadAttachment, useDeleteAttachment } from "@/hooks/useAttachments";
import { AttachmentGrid } from "@/components/cms/AttachmentGrid";
import { FileDropzone } from "@/components/cms/FileDropzone";
import { useState } from "react"; // likely already imported
import { toast } from "sonner";
```

- [ ] **Step 2: Add hooks inside the component**

After the existing hooks (after `useFeedback`):

```typescript
const { data: attachments = [] } = useAttachments(id!);
const uploadAttachment = useUploadAttachment(id!);
const deleteAttachment = useDeleteAttachment(id!);
const [pendingFiles, setPendingFiles] = useState<File[]>([]);
const isAdmin = user?.roles?.includes('admin');
const canUpload = attachments.length < 3;
```

- [ ] **Step 3: Add attachment section to JSX**

Add after the feedback section (before closing column div):

```tsx
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.35 }}
  className="card-surface p-5"
>
  <h2 className="mb-4 text-sm font-semibold text-foreground">
    Attachments ({attachments.length}/3)
  </h2>

  <AttachmentGrid
    attachments={attachments}
    currentUserId={user?.id}
    isAdmin={isAdmin}
    onDelete={(attachmentId) =>
      deleteAttachment.mutate(attachmentId, {
        onError: () => toast.error("Failed to delete attachment"),
      })
    }
    deleting={deleteAttachment.isPending}
  />

  {canUpload && (
    <div className="mt-3 space-y-2">
      <FileDropzone
        files={pendingFiles}
        onChange={setPendingFiles}
        maxFiles={3 - attachments.length}
      />
      {pendingFiles.length > 0 && (
        <button
          className="w-full rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
          disabled={uploadAttachment.isPending}
          onClick={async () => {
            for (const file of pendingFiles) {
              await uploadAttachment.mutateAsync(file).catch(() => {
                toast.error(`Failed to upload ${file.name}`);
              });
            }
            setPendingFiles([]);
            toast.success("Files uploaded");
          }}
        >
          {uploadAttachment.isPending ? "Uploading..." : `Upload ${pendingFiles.length} file(s)`}
        </button>
      )}
    </div>
  )}
</motion.div>
```

- [ ] **Step 4: Verify compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ComplaintDetail.tsx
git commit -m "feat(attachments): add attachment section to ComplaintDetail"
```

---

### Task 12: Add Dropzone to FileComplaintDialog

**Files:**
- Modify: `frontend/src/components/cms/FileComplaintDialog.tsx`

- [ ] **Step 1: Add imports and state**

```typescript
import { FileDropzone } from "@/components/cms/FileDropzone";
import { useUploadAttachment } from "@/hooks/useAttachments";
import { useState } from "react"; // may already exist
```

Inside the component, add state:
```typescript
const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
```

- [ ] **Step 2: Add dropzone to form JSX**

Add after the last form field and before the submit button:

```tsx
<div className="space-y-1">
  <label className="text-xs text-muted-foreground">Attachments (optional, max 3)</label>
  <FileDropzone files={attachmentFiles} onChange={setAttachmentFiles} />
</div>
```

- [ ] **Step 3: Upload files after complaint creation**

In the `onSubmit` handler, after the complaint is created (after `createComplaint.mutateAsync()`), add:

```typescript
// Upload attachments after complaint is created
if (attachmentFiles.length > 0 && newComplaint?.id) {
  const uploadFn = useUploadAttachment(newComplaint.id); // Note: use the hook at component level
  for (const file of attachmentFiles) {
    await uploadFn.mutateAsync(file).catch((e) => {
      console.error(`Failed to upload ${file.name}`, e);
    });
  }
  setAttachmentFiles([]);
}
```

**Important:** Move `const uploadAttachment = useUploadAttachment(complaintId)` to component level. Since the complaintId is not known until after creation, use a ref or state to store it:

```typescript
const [newComplaintId, setNewComplaintId] = useState<string | null>(null);
const uploadAttachment = useUploadAttachment(newComplaintId ?? '');

// In onSubmit:
const complaint = await createComplaint.mutateAsync(data);
setNewComplaintId(complaint.id);
for (const file of attachmentFiles) {
  await uploadAttachment.mutateAsync(file).catch(console.error);
}
setAttachmentFiles([]);
setNewComplaintId(null);
```

- [ ] **Step 4: Verify compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/cms/FileComplaintDialog.tsx
git commit -m "feat(attachments): add file dropzone to FileComplaintDialog"
```

---

## Chunk 3: Email Integration

### Task 13: Embed Attachments in Email Notifications

**Files:**
- Modify: `ResolveIQ-Backend/src/modules/complaints/complaint-notifier.service.ts`

- [ ] **Step 1: Inject AttachmentsService**

Add import:
```typescript
import { AttachmentsService } from '../attachments/attachments.service';
```

Add to constructor:
```typescript
private readonly attachmentsService: AttachmentsService,
```

- [ ] **Step 2: Add HTML builder helper**

Add private method to `ComplaintNotifierService`:

```typescript
private async buildAttachmentsHtml(complaintId: string): Promise<string> {
  const attachments = await this.attachmentsService.findByComplaint(complaintId);
  if (!attachments.length) return '';

  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const parts = attachments.map((a) => {
    if (a.mimetype.startsWith('image/')) {
      return `<div style="margin:4px 0"><img src="${a.url}" alt="${esc(a.filename)}" style="max-width:400px;border-radius:4px" /></div>`;
    }
    return `<div style="margin:4px 0">📎 <a href="${a.url}">${esc(a.filename)}</a></div>`;
  });

  return `<div style="margin-top:12px"><strong>Attachments:</strong>${parts.join('')}</div>`;
}
```

- [ ] **Step 3: Call in sendNotificationToRecipients**

In the `sendNotificationToRecipients` private method, find where `html` is built and append the attachments HTML:

```typescript
const attachmentsHtml = await this.buildAttachmentsHtml(opts.complaint.id);
// append to the existing html string before passing to emailService.sendMail
const fullHtml = html + attachmentsHtml;
```

- [ ] **Step 4: Verify compiles**

```bash
cd ResolveIQ-Backend && npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add ResolveIQ-Backend/src/modules/complaints/complaint-notifier.service.ts
git commit -m "feat(attachments): embed images and link documents in email notifications"
```

---

### Task 14: Final Verification

- [ ] **Step 1: Start backend**

```bash
cd ResolveIQ-Backend && npm run start:dev
```
Expected: Server starts, `attachments` table auto-created by TypeORM

- [ ] **Step 2: Start frontend**

```bash
cd frontend && npm run dev
```

- [ ] **Step 3: End-to-end test**

1. File a new complaint with 2 attachments (1 image + 1 PDF)
2. Verify attachments appear in ComplaintDetail
3. Delete one attachment — verify it's removed from grid and Cloudinary
4. Try uploading a 4th file — verify 400 error / UI blocks it
5. Check that email received contains inline image + PDF link

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete complaint attachments with Cloudinary, UI, and email integration"
git push
```

---

## Summary

| Task | Area | Key Work |
|------|------|----------|
| 1–2 | Backend | Install deps, entity |
| 3–5 | Backend | Service + controller + module wiring |
| 6–8 | Frontend | Types + hooks + install react-dropzone |
| 9–10 | Frontend | FileDropzone + AttachmentGrid components |
| 11–12 | Frontend | Wire into ComplaintDetail + FileComplaintDialog |
| 13 | Email | Embed images + link docs in notification HTML |
| 14 | Integration | End-to-end verification |
