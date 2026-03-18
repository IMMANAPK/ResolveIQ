import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { Download, XCircle, CheckCircle2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import api from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

// ── Types ──────────────────────────────────────────────────────────────────

const VALID_ROLES = ["complainant", "committee_member", "manager", "admin"] as const;
type ValidRole = typeof VALID_ROLES[number];
type RowStatus = "valid" | "error";
type ImportResult = "pending" | "created" | "duplicate" | "failed";

interface ParsedRow {
  rowNum: number;
  fullName: string;
  email: string;
  roles: ValidRole[];
  rolesRaw: string;
  department: string;
  status: RowStatus;
  error: string;
}

interface ImportRow extends ParsedRow {
  result: ImportResult;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateRow(raw: Record<string, string>, rowNum: number): ParsedRow {
  const fullName = (raw["fullname"] ?? "").trim();
  const email = (raw["email"] ?? "").trim();
  const rolesRaw = (raw["roles"] ?? raw["role"] ?? "").trim();
  const department = (raw["department"] ?? "").trim();

  // Parse comma-separated roles
  const parsedRoles = rolesRaw
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);

  const base = { rowNum, fullName, email, rolesRaw, roles: [] as ValidRole[], department };

  if (fullName.length < 2) {
    return { ...base, status: "error", error: "Full name must be at least 2 characters" };
  }
  if (!email || !isValidEmail(email)) {
    return { ...base, status: "error", error: "Invalid or missing email" };
  }
  if (parsedRoles.length === 0) {
    return { ...base, status: "error", error: "No roles specified" };
  }
  const invalid = parsedRoles.find((r) => !VALID_ROLES.includes(r as ValidRole));
  if (invalid) {
    return { ...base, status: "error", error: `Invalid role "${invalid}" — use: complainant, committee_member, manager, admin` };
  }
  return { ...base, roles: parsedRoles as ValidRole[], status: "valid", error: "" };
}

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ["fullName", "email", "roles", "department"],
    ["John Doe", "john@example.com", "complainant", ""],
    ["Jane Smith", "jane@example.com", "complainant,committee_member", "Women's Safety Committee"],
    ["Bob Manager", "bob@example.com", "manager", ""],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Users");
  XLSX.writeFile(wb, "user-import-template.xlsx");
}

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportUsersDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileError, setFileError] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [processed, setProcessed] = useState(0);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(1);
      setFileError("");
      setParsedRows([]);
      setImportRows([]);
      setProcessed(0);
      setImporting(false);
      setDone(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [open]);

  // ── File parse ────────────────────────────────────────────────────────────

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError("");

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });

        if (rawRows.length === 0) {
          setFileError("No data rows found. Please add users to the template.");
          return;
        }
        if (rawRows.length > 500) {
          setFileError("File exceeds the 500-row limit.");
          return;
        }

        // Lowercase all keys for case-insensitive column matching
        const lowered = rawRows.map((r) =>
          Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), String(v)]))
        );

        const required = ["fullname", "email", "role"] as const;
        const missing = required.find((col) => !(col in lowered[0]));
        if (missing) {
          setFileError(`Missing required column: "${missing}". Please use the provided template.`);
          return;
        }

        const validated = lowered.map((r, i) => validateRow(r, i + 2));
        setParsedRows(validated);
        setStep(2);
      } catch {
        setFileError("Could not read file. Please use the provided template.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // ── Import ────────────────────────────────────────────────────────────────

  async function handleImport() {
    const validRows = parsedRows.filter((r) => r.status === "valid");
    const rows: ImportRow[] = validRows.map((r) => ({ ...r, result: "pending" }));
    setImportRows(rows);
    setStep(3);
    setImporting(true);
    setProcessed(0);
    setDone(false);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        await api.post("/users", {
          email: row.email,
          fullName: row.fullName,
          roles: row.roles,
          department: row.department || undefined,
          password: "Welcome@123",
        });
        rows[i] = { ...row, result: "created" };
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        rows[i] = { ...row, result: status === 409 ? "duplicate" : "failed" };
      }
      setImportRows([...rows]);
      setProcessed(i + 1);
    }

    setImporting(false);
    setDone(true);
  }

  function handleDone() {
    qc.invalidateQueries({ queryKey: ["users"] });
    onOpenChange(false);
  }

  const validCount = parsedRows.filter((r) => r.status === "valid").length;
  const errorCount = parsedRows.filter((r) => r.status === "error").length;
  const totalImport = importRows.length;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (importing) return; // block close while importing
        if (!v) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-2xl flex flex-col max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && "Import Users from Excel"}
            {step === 2 && `Preview — ${validCount} valid, ${errorCount} errors`}
            {step === 3 && "Importing Users"}
          </DialogTitle>
        </DialogHeader>

        {/* ── Step 1: Upload ── */}
        {step === 1 && (
          <div className="space-y-5 py-2">
            <p className="text-sm text-muted-foreground">
              Upload an Excel file with columns:{" "}
              <code className="text-xs bg-muted px-1 rounded">fullName</code>,{" "}
              <code className="text-xs bg-muted px-1 rounded">email</code>,{" "}
              <code className="text-xs bg-muted px-1 rounded">roles</code> (comma-separated),{" "}
              <code className="text-xs bg-muted px-1 rounded">department</code> (optional).
            </p>

            <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadTemplate}>
              <Download className="h-3.5 w-3.5" />
              Download Template
            </Button>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Upload File</p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFile}
                className="block w-full text-sm text-muted-foreground
                  file:mr-3 file:rounded-md file:border-0 file:bg-primary
                  file:px-3 file:py-1.5 file:text-xs file:font-medium
                  file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              />
              {fileError && (
                <p className="text-xs text-destructive flex items-center gap-1.5">
                  <XCircle className="h-3.5 w-3.5 shrink-0" /> {fileError}
                </p>
              )}
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Valid roles (comma-separate multiple):</p>
              <p><code>complainant</code>, <code>committee_member</code>, <code>manager</code>, <code>admin</code></p>
              <p className="mt-1">Example: <code>complainant,committee_member</code></p>
              <p className="mt-1">Default password <code>Welcome@123</code> will be assigned to all imported users.</p>
            </div>
          </div>
        )}

        {/* ── Step 2: Preview ── */}
        {step === 2 && (
          <div className="flex flex-col gap-4 min-h-0 flex-1">
            <div className="overflow-auto flex-1 rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    {["#", "Full Name", "Email", "Roles", "Department", "Status"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {parsedRows.map((row) => (
                    <tr key={row.rowNum} className={row.status === "error" ? "bg-destructive/5" : ""}>
                      <td className="px-3 py-2 text-muted-foreground">{row.rowNum}</td>
                      <td className="px-3 py-2">{row.fullName || <em className="text-muted-foreground">—</em>}</td>
                      <td className="px-3 py-2">{row.email || <em className="text-muted-foreground">—</em>}</td>
                      <td className="px-3 py-2">{row.rolesRaw || <em className="text-muted-foreground">—</em>}</td>
                      <td className="px-3 py-2">{row.department || <em className="text-muted-foreground">—</em>}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.status === "valid" ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Valid
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-destructive">
                            <XCircle className="h-3.5 w-3.5 shrink-0" /> {row.error}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => {
                setStep(1);
                setParsedRows([]);
                setFileError("");
                if (fileRef.current) fileRef.current.value = "";
              }}>
                Back
              </Button>
              <Button size="sm" disabled={validCount === 0} onClick={handleImport}>
                Import {validCount} user{validCount !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Importing ── */}
        {step === 3 && (
          <div className="flex flex-col gap-4 min-h-0 flex-1">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{processed} of {totalImport} processed</span>
                <span>{Math.round((processed / Math.max(totalImport, 1)) * 100)}%</span>
              </div>
              <Progress value={(processed / Math.max(totalImport, 1)) * 100} />
            </div>

            <div className="overflow-auto flex-1 rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    {["#", "Email", "Name", "Result"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {importRows.map((row) => (
                    <tr key={row.rowNum}>
                      <td className="px-3 py-2 text-muted-foreground">{row.rowNum}</td>
                      <td className="px-3 py-2">{row.email}</td>
                      <td className="px-3 py-2">{row.fullName}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.result === "pending" && <span className="text-muted-foreground">Waiting…</span>}
                        {row.result === "created" && (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Created
                          </span>
                        )}
                        {row.result === "duplicate" && (
                          <span className="flex items-center gap-1 text-destructive">
                            <XCircle className="h-3.5 w-3.5" /> Email already registered
                          </span>
                        )}
                        {row.result === "failed" && (
                          <span className="flex items-center gap-1 text-destructive">
                            <XCircle className="h-3.5 w-3.5" /> Failed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {done && (
              <div className="flex justify-end">
                <Button size="sm" onClick={handleDone}>Done</Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
