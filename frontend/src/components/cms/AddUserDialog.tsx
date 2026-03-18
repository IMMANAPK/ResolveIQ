import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useCreateUser } from "@/hooks/useUsers";

const ROLE_OPTIONS = [
  { value: "complainant",      label: "Complainant" },
  { value: "committee_member", label: "Committee Member" },
  { value: "manager",          label: "Manager" },
  { value: "admin",            label: "Admin" },
] as const;

type RoleValue = typeof ROLE_OPTIONS[number]["value"];

const schema = z.object({
  fullName:   z.string().min(2, "Full name must be at least 2 characters"),
  email:      z.string().email("Invalid email address"),
  roles:      z.array(z.enum(["complainant", "committee_member", "manager", "admin"] as const))
                .min(1, "Select at least one role"),
  department: z.string().optional(),
  password:   z.string().min(6, "Password must be at least 6 characters"),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddUserDialog({ open, onOpenChange }: Props) {
  const createUser = useCreateUser();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { roles: ["complainant"], department: "", password: "", fullName: "", email: "" },
  });

  const selectedRoles = watch("roles") ?? [];
  const showDepartment = selectedRoles.includes("committee_member");

  function toggleRole(value: RoleValue) {
    const current = selectedRoles;
    if (current.includes(value)) {
      setValue("roles", current.filter((r) => r !== value), { shouldValidate: true });
    } else {
      setValue("roles", [...current, value], { shouldValidate: true });
    }
  }

  const onSubmit = async (data: FormData) => {
    try {
      await createUser.mutateAsync({
        email:      data.email,
        password:   data.password,
        fullName:   data.fullName,
        roles:      data.roles,
        department: showDepartment && data.department ? data.department : undefined,
      });
      toast.success("User created successfully");
      reset();
      onOpenChange(false);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        toast.error("Email already registered");
      } else {
        toast.error("Failed to create user");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" placeholder="Jane Smith" {...register("fullName")} />
            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="jane@example.com" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          {/* Roles — multi-checkbox */}
          <div className="space-y-1.5">
            <Label>Roles</Label>
            <div className="grid grid-cols-2 gap-2">
              {ROLE_OPTIONS.map(({ value, label }) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedRoles.includes(value)}
                    onCheckedChange={() => toggleRole(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
            {errors.roles && <p className="text-xs text-destructive">{errors.roles.message}</p>}
          </div>

          {/* Committee Name — only visible when committee_member is selected */}
          {showDepartment && (
            <div className="space-y-1.5">
              <Label htmlFor="department">Committee Name</Label>
              <Input
                id="department"
                placeholder="e.g. Women's Safety Committee"
                {...register("department")}
              />
            </div>
          )}

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="Min 6 characters" {...register("password")} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
