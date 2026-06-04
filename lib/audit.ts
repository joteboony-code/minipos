import { Prisma } from "@prisma/client";
import { getSession, type Role } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AuditInput = {
  actorRole?: Role | string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  description?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

const blockedMetadataKeys = new Set(["pin", "password", "auth_secret", "authsecret", "database_url", "databaseurl", "promptpay_id", "promptpayid"]);

function scrubMetadata(value: Prisma.InputJsonValue | null | undefined): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) return value.map((entry) => scrubMetadata(entry as Prisma.InputJsonValue) ?? null);
  if (typeof value === "object") {
    const safe: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (blockedMetadataKeys.has(key.replaceAll(/[^a-zA-Z0-9]/g, "").toLowerCase())) continue;
      const scrubbed = scrubMetadata(entry as Prisma.InputJsonValue);
      if (scrubbed !== undefined) safe[key] = scrubbed;
    }
    return safe;
  }
  return value;
}

export async function recordAuditLog(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        actorRole: input.actorRole ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        description: input.description ?? null,
        metadata: scrubMetadata(input.metadata) ?? Prisma.JsonNull
      }
    });
  } catch (error) {
    console.error("[audit] failed to record audit log", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function recordAuditLogForCurrentSession(input: Omit<AuditInput, "actorRole"> & { actorRole?: Role | string | null }) {
  const session = await getSession();
  await recordAuditLog({
    ...input,
    actorRole: input.actorRole ?? session?.role ?? null
  });
}
