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
          <div key={a.id} className="group relative overflow-hidden rounded-lg border bg-muted/30">
            {isImage ? (
              <a href={a.url} target="_blank" rel="noreferrer">
                <img src={a.url} alt={a.filename} className="h-24 w-full object-cover" />
              </a>
            ) : (
              <a href={a.url} target="_blank" rel="noreferrer" className="flex h-24 flex-col items-center justify-center gap-1">
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
