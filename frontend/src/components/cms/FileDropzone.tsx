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
