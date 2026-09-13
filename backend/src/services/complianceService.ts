import {
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import {
  buildPackManifest,
  readiness,
  renderExport,
  type ExportFormat,
} from "../lib/compliance.js";
import {
  localPresigner,
  newStorageKey,
  type StoragePresigner,
} from "../lib/storage.js";

const DEFAULT_REQUIREMENTS = [
  [
    "Tax Clearance Certificate",
    "SARS PIN - mandatory eligibility gate",
  ],
  ["CSD Registration", "MAAA reference confirmed"],
  [
    "Company Profile",
    "Capability statement and references",
  ],
  [
    "B-BBEE Certificate",
    "Certificate or sworn affidavit",
  ],
  [
    "Pricing Schedule",
    "Complete the supplied pricing template",
  ],
  [
    "Technical Proposal",
    "Methodology and technical compliance",
  ],
  [
    "Briefing Attendance",
    "Required where the briefing is compulsory",
  ],
] as const;

export class ComplianceAccessError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ComplianceAccessError";
  }
}

export interface RequirementPatch {
  status?: "complete" | "expiring" | "missing";
  ownerId?: string | null;
}

export interface CreateTaskInput {
  title: string;
  ownerId: string | null;
  due: Date | null;
}

export interface PresignDocumentInput {
  name: string;
  contentType: string;
  category: string;
  expiresAt: Date | null;
  sizeBytes: number | null;
}

export class ComplianceService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly presigner: StoragePresigner =
      localPresigner,
  ) {}

  private async requireMembership(
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const membership = await this.prisma.member.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!membership) {
      throw new ComplianceAccessError(
        "You do not have access to this tenant.",
        403,
      );
    }
  }

  private async requireTenantUser(
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const membership = await this.prisma.member.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!membership) {
      throw new ComplianceAccessError(
        "The selected owner is not a tenant member.",
        400,
      );
    }
  }

  private async requireCard(
    tenantId: string,
    userId: string,
    cardId: string,
  ) {
    await this.requireMembership(tenantId, userId);

    const card = await this.prisma.workspaceCard.findFirst({
      where: {
        id: cardId,
        tenantId,
      },
      include: {
        tender: {
          select: {
            title: true,
          },
        },
      },
    });

    if (!card) {
      throw new ComplianceAccessError(
        "Workspace card not found.",
        404,
      );
    }

    return card;
  }

  private async requirementResponse(cardId: string) {
    const rows = await this.prisma.requirement.findMany({
      where: {
        cardId,
      },
      orderBy: [
        {
          sortOrder: "asc",
        },
        {
          id: "asc",
        },
      ],
    });

    return {
      requirements: rows.map((row) => ({
        id: row.id,
        name: row.name,
        detail: row.detail,
        status: row.status,
        ownerId: row.ownerId,
        sortOrder: row.sortOrder,
      })),
      readiness: readiness(rows),
    };
  }

  private async ensureDefaultRequirements(
    cardId: string,
  ): Promise<void> {
    const count = await this.prisma.requirement.count({
      where: {
        cardId,
      },
    });

    if (count > 0) {
      return;
    }

    await this.prisma.requirement.createMany({
      data: DEFAULT_REQUIREMENTS.map(
        ([name, detail], sortOrder) => ({
          cardId,
          name,
          detail,
          sortOrder,
        }),
      ),
      skipDuplicates: true,
    });
  }

  async requirements(
    tenantId: string,
    userId: string,
    cardId: string,
  ) {
    await this.requireCard(tenantId, userId, cardId);

    await this.ensureDefaultRequirements(cardId);

    return this.requirementResponse(cardId);
  }

  async updateRequirement(
    tenantId: string,
    userId: string,
    cardId: string,
    requirementId: string,
    patch: RequirementPatch,
  ) {
    await this.requireCard(tenantId, userId, cardId);

    if (patch.ownerId) {
      await this.requireTenantUser(tenantId, patch.ownerId);
    }

    const result = await this.prisma.requirement.updateMany({
      where: {
        id: requirementId,
        cardId,
      },
      data: patch,
    });

    if (result.count === 0) {
      throw new ComplianceAccessError(
        "Requirement not found.",
        404,
      );
    }

    return this.requirementResponse(cardId);
  }

  async tasks(
    tenantId: string,
    userId: string,
    cardId: string,
  ) {
    await this.requireCard(tenantId, userId, cardId);

    const rows = await this.prisma.bidTask.findMany({
      where: {
        cardId,
      },
      orderBy: [
        {
          createdAt: "asc",
        },
        {
          id: "asc",
        },
      ],
    });

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      done: row.done,
      ownerId: row.ownerId,
      due: row.due?.toISOString() ?? null,
    }));
  }

  async createTask(
    tenantId: string,
    userId: string,
    cardId: string,
    input: CreateTaskInput,
  ) {
    await this.requireCard(tenantId, userId, cardId);

    if (input.ownerId) {
      await this.requireTenantUser(tenantId, input.ownerId);
    }

    await this.prisma.bidTask.create({
      data: {
        cardId,
        title: input.title,
        ownerId: input.ownerId,
        due: input.due,
      },
    });

    return this.tasks(tenantId, userId, cardId);
  }

  async toggleTask(
    tenantId: string,
    userId: string,
    cardId: string,
    taskId: string,
  ) {
    await this.requireCard(tenantId, userId, cardId);

    const task = await this.prisma.bidTask.findFirst({
      where: {
        id: taskId,
        cardId,
      },
      select: {
        id: true,
        done: true,
      },
    });

    if (!task) {
      throw new ComplianceAccessError(
        "Task not found.",
        404,
      );
    }

    await this.prisma.bidTask.update({
      where: {
        id: task.id,
      },
      data: {
        done: !task.done,
      },
    });

    return this.tasks(tenantId, userId, cardId);
  }

  private async buildManifest(
    tenantId: string,
    userId: string,
    cardId: string,
  ) {
    const card = await this.requireCard(
      tenantId,
      userId,
      cardId,
    );

    await this.ensureDefaultRequirements(cardId);

    const [requirements, vaultDocuments] =
      await Promise.all([
        this.prisma.requirement.findMany({
          where: {
            cardId,
          },
          orderBy: {
            sortOrder: "asc",
          },
        }),
        this.prisma.vaultDocument.findMany({
          where: {
            tenantId,
          },
          orderBy: {
            createdAt: "asc",
          },
        }),
      ]);

    return buildPackManifest(
      card.tender.title,
      requirements,
      vaultDocuments,
    );
  }

  async generatePack(
    tenantId: string,
    userId: string,
    cardId: string,
  ) {
    const manifest = await this.buildManifest(
      tenantId,
      userId,
      cardId,
    );

    const pack = await this.prisma.submissionPack.create({
      data: {
        cardId,
        status:
          manifest.missing.length === 0
            ? "ready"
            : "draft",
        manifest: manifest as unknown as Prisma.InputJsonValue,
        generatedBy: userId,
      },
    });

    return {
      packId: pack.id,
      status: pack.status,
      manifest,
    };
  }

  async exportPack(
    tenantId: string,
    userId: string,
    cardId: string,
    format: ExportFormat,
  ) {
    const manifest = await this.buildManifest(
      tenantId,
      userId,
      cardId,
    );

    const safeTitle =
      manifest.bidTitle
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase() || "submission-pack";

    return {
      format,
      filename: `${safeTitle}-${format}.txt`,
      contentType:
        "text/plain; charset=utf-8" as const,
      body: renderExport(manifest, format),
    };
  }

  async vaultGrouped(
    tenantId: string,
    userId: string,
  ) {
    await this.requireMembership(tenantId, userId);

    const rows = await this.prisma.vaultDocument.findMany({
      where: {
        tenantId,
      },
      orderBy: [
        {
          category: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

    const groups = new Map<string, typeof rows>();

    for (const row of rows) {
      const group = groups.get(row.category) ?? [];
      group.push(row);
      groups.set(row.category, group);
    }

    return [...groups.entries()].map(
      ([category, documents]) => ({
        category,
        documents: documents.map((document) => ({
          id: document.id,
          category: document.category,
          name: document.name,
          ext: document.ext,
          contentType: document.contentType,
          status: document.status,
          expiresAt:
            document.expiresAt?.toISOString() ?? null,
          version: document.version,
          sizeBytes: document.sizeBytes,
          createdAt: document.createdAt.toISOString(),
        })),
      }),
    );
  }

  async presignUpload(
    tenantId: string,
    userId: string,
    input: PresignDocumentInput,
  ) {
    await this.requireMembership(tenantId, userId);

    const extension =
      input.name.includes(".")
        ? input.name.split(".").pop()
        : undefined;

    const storageKey = newStorageKey(
      tenantId,
      extension,
    );

    const upload = await this.presigner.presignUpload({
      storageKey,
      contentType: input.contentType,
      ...(input.sizeBytes !== null
        ? {
            sizeBytes: input.sizeBytes,
          }
        : {}),
    });

    const document =
      await this.prisma.vaultDocument.create({
        data: {
          tenantId,
          name: input.name,
          category: input.category,
          ext: extension?.toLowerCase() ?? null,
          contentType: input.contentType,
          expiresAt: input.expiresAt,
          sizeBytes: input.sizeBytes,
          storageKey,
          uploadedBy: userId,
        },
      });

    return {
      documentId: document.id,
      storageKey,
      uploadUrl: upload.uploadUrl,
      method: upload.method,
      headers: upload.headers,
    };
  }

  async expiring(
    tenantId: string,
    userId: string,
    days: number,
    now = new Date(),
  ) {
    await this.requireMembership(tenantId, userId);

    const end = new Date(
      now.getTime() + days * 86_400_000,
    );

    const documents =
      await this.prisma.vaultDocument.findMany({
        where: {
          tenantId,
          expiresAt: {
            gte: now,
            lte: end,
          },
        },
        orderBy: {
          expiresAt: "asc",
        },
      });

    return documents.map((document) => ({
      id: document.id,
      name: document.name,
      category: document.category,
      expiresAt: document.expiresAt!.toISOString(),
      daysLeft: Math.ceil(
        (document.expiresAt!.getTime() -
          now.getTime()) /
          86_400_000,
      ),
    }));
  }
}
