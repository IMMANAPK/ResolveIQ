# Complaint Attachments — Design Spec

**Date:** 2026-03-21
**Feature:** File attachment support for complaints (Cloudinary)

---

## Overview

Allow complainants and committee members to attach files (images + documents) to complaints. Files are uploaded via the backend to Cloudinary. Attachments appear in complaint detail and are embedded/linked in email notifications.

---

## Constraints

| Rule | Value |
|------|-------|
| Max files per complaint | 3 |
| Max file size | 10 MB each |
| Allowed types | jpg, png, webp, pdf, docx, xlsx |
| Who can upload | complainant (own complaints), committee_member, admin, manager |
| Who can delete | uploader or admin |
| When | At creation OR anytime after |

---

## Backend

### New Module: `attachments`

**Entity: `attachments` table**

```typescript
@Entity('attachments')
export class Attachment extends BaseEntity {
  @Column() complaintId: string;
  @ManyToOne(() => Complaint) complaint: Complaint;

  @Column() uploadedById: string;
  @ManyToOne(() => User) uploadedBy: User;

  @Column() url: string;           // Cloudinary secure URL
  @Column() publicId: string;      // Cloudinary public_id (for deletion)
  @Column() resourceType: string;  // 'image' or 'raw' — required for cloudinary.destroy()
  @Column() filename: string;      // original filename
  @Column() mimetype: string;      // e.g. image/jpeg
  @Column() size: number;          // bytes
}
```

**Service: `AttachmentsService`**

- `findByComplaint(complaintId)` — return all attachments
- `upload(complaintId, userId, userRoles, file)`:
  1. Fetch complaint → 404 if missing
  2. If complainant role: assert `complaint.raisedById === userId` → 403 if not
  3. Count existing attachments in DB → 400 if already 3 (checked before upload)
  4. Upload to Cloudinary → get `{ url, publicId, resourceType }`
  5. Save DB record — if save fails: call `cloudinary.uploader.destroy(publicId, { resource_type })` then throw 500
- `delete(attachmentId, complaintId, userId, userRoles)`:
  - Assert `attachment.complaintId === complaintId` → 404 if mismatch
  - Assert uploader or admin → 403 if not
  - `cloudinary.uploader.destroy(publicId, { resource_type: attachment.resourceType })`
  - Delete DB record

**Controller: `@Controller('complaints/:complaintId/attachments')`**

```
POST   /complaints/:complaintId/attachments     — upload (Multer, max 3 files)
GET    /complaints/:complaintId/attachments     — list attachments
DELETE /complaints/:complaintId/attachments/:id — delete one
```

All routes: `JwtAuthGuard`

**Multer config (in-memory):**
```typescript
@UseInterceptors(FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg','image/png','image/webp',
                     'application/pdf',
                     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!allowed.includes(file.mimetype)) cb(new BadRequestException('Invalid file type'), false);
    else cb(null, true);
  }
}))
```

**Cloudinary upload:**
```typescript
// upload from buffer
cloudinary.uploader.upload_stream(
  { folder: 'resolveiq/complaints', resource_type: 'auto' },
  callback
)
```

**Env vars needed:**
```
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

**New deps:**
```bash
npm install cloudinary multer @types/multer
```

**Module registration:** `AttachmentsModule` imported in `AppModule`

---

## Frontend

### New type: `ApiAttachment`
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
}
```

### New hook: `useAttachments`
```typescript
useAttachments(complaintId)      // GET list
useUploadAttachment(complaintId) // POST mutation
useDeleteAttachment(complaintId) // DELETE mutation
```

### FileComplaintDialog — add dropzone
- Use `react-dropzone` for drag-and-drop
- Show file previews (thumbnail for images, icon for docs)
- Upload after complaint is created (get complaintId first, then upload each file)

### ComplaintDetail — attachment section
- Grid of thumbnails (images) + file cards (documents)
- Delete button (own files or admin)
- "Add files" button (opens file picker)
- New dep: `react-dropzone`

```bash
npm install react-dropzone
```

---

## Email Notifications

Modify `ComplaintNotifierService.sendNotificationToRecipients()`:

1. Fetch attachments — skip if empty (no change to existing email HTML)
2. HTML-escape `filename` before interpolation (prevent XSS):
   ```typescript
   const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
   ```
3. For each attachment:
   - **Image** (jpeg/png/webp): `<img src="${attachment.url}" style="max-width:400px" />`
   - **Document**: `<a href="${attachment.url}">${esc(attachment.filename)}</a>`

---

## Data Flow

```
User selects files in UI
       │
       ▼
POST /complaints/:id/attachments (multipart/form-data)
       │
       ▼
Multer → memory buffer
       │
       ▼
AttachmentsService.upload()
  ├── check count ≤ 3
  ├── cloudinary.uploader.upload_stream()
  └── save Attachment record (url, publicId, filename, mimetype, size)
       │
       ▼
Return { id, url, filename }
       │
       ▼
Frontend shows thumbnail/file card
```

---

## Error Cases

| Case | Response |
|------|----------|
| > 3 attachments | 400 Bad Request |
| File > 10MB | 400 Bad Request |
| Invalid mimetype | 400 Bad Request |
| Cloudinary upload fails | 500, log error |
| DB save fails after Cloudinary upload | destroy Cloudinary asset, return 500 |
| Delete by non-owner non-admin | 403 Forbidden |
| Attachment belongs to different complaint | 404 Not Found |
| Complainant uploads to another's complaint | 403 Forbidden |
| Complaint not found | 404 Not Found |

---

## Implementation Order

1. Backend: entity + Cloudinary service + AttachmentsService + controller + module
2. Frontend: types + hooks + ComplaintDetail attachment section
3. Frontend: FileComplaintDialog dropzone
4. Email: embed images + link documents
