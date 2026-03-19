import { NodeHandler } from './index';

/** Fields that workflow nodes are permitted to update on a complaint. */
const ALLOWED_FIELDS = new Set(['status', 'priority', 'committeeId']);

/**
 * Update a whitelisted complaint field.
 *
 * Config fields:
 *   field: 'status' | 'priority' | 'committeeId'
 *   value: string
 *
 * Skipped in dry-run (side-effect node).
 * Rejects attempts to update any field not in the whitelist.
 */
export const updateComplaintHandler: NodeHandler = async ({ config, complaint, complaintRepo, dryRun }) => {
  if (dryRun) return { skipped: true };

  const field = config.field as string;
  const value = config.value;

  if (!field || !ALLOWED_FIELDS.has(field)) {
    return {
      output: {
        error: `update_complaint: field "${field}" is not allowed. Permitted: ${[...ALLOWED_FIELDS].join(', ')}`,
      },
    };
  }

  if (value !== undefined) {
    await complaintRepo.update(complaint.id, { [field]: value });
  }

  return {};
};
