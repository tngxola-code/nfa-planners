import {
  Prisma,
  type AiReviewJob,
  type PrismaClient,
} from "@prisma/client";
import {
  ruleBasedAnalyzer,
  type AiAnalyzer,
} from "../lib/aiAnalyzer.js";
import {
  REVIEW_STEPS,
  type Finding,
  type JobResult,
  type JobStatusDto,
  type ReviewStatus,
  type ReviewType,
} from "../types/aiReview.js";

export class AiReviewAccessError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AiReviewAccessError";
  }
}

export interface AiReviewServiceOptions {
  autoProcess?: boolean;
  stepDelayMs?: number;
}

function stringArray(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is string =>
      typeof entry === "string",
  );
}

function findingsArray(
  value: Prisma.JsonValue | null,
): Finding[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value as unknown as Finding[];
}

export class AiReviewService {
  private readonly autoProcess: boolean;
  private readonly stepDelayMs: number;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly analyzer: AiAnalyzer =
      ruleBasedAnalyzer,
    options: AiReviewServiceOptions = {},
  ) {
    this.autoProcess = options.autoProcess ?? true;
    this.stepDelayMs = options.stepDelayMs ?? 900;
  }

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
      throw new AiReviewAccessError(
        "Tenant membership required.",
        403,
      );
    }
  }

  private async requireCard(
    tenantId: string,
    userId: string,
    cardId: string,
  ) {
    await this.requireMembership(tenantId, userId);

    const card =
      await this.prisma.workspaceCard.findFirst({
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
      throw new AiReviewAccessError(
        "Bid not found.",
        404,
      );
    }

    return card;
  }

  private async requireJob(
    tenantId: string,
    userId: string,
    jobId: string,
  ): Promise<AiReviewJob> {
    await this.requireMembership(tenantId, userId);

    const job = await this.prisma.aiReviewJob.findFirst({
      where: {
        id: jobId,
        tenantId,
        requestedBy: userId,
      },
    });

    if (!job) {
      throw new AiReviewAccessError(
        "AI review job not found.",
        404,
      );
    }

    return job;
  }

  private async resolveDocumentIds(
    tenantId: string,
    requestedDocumentIds?: string[],
  ): Promise<string[]> {
    const documents =
      await this.prisma.vaultDocument.findMany({
        where: {
          tenantId,
          ...(requestedDocumentIds
            ? {
                id: {
                  in: requestedDocumentIds,
                },
              }
            : {}),
        },
        select: {
          id: true,
        },
        orderBy: {
          id: "asc",
        },
      });

    if (
      requestedDocumentIds &&
      documents.length !== requestedDocumentIds.length
    ) {
      throw new AiReviewAccessError(
        "One or more selected documents were not found.",
        400,
      );
    }

    return documents.map((document) => document.id);
  }

  async start(
    tenantId: string,
    userId: string,
    cardId: string,
    reviewType: ReviewType,
    requestedDocumentIds?: string[],
  ): Promise<{ jobId: string }> {
    await this.requireCard(tenantId, userId, cardId);

    const documentIds = await this.resolveDocumentIds(
      tenantId,
      requestedDocumentIds,
    );

    const job = await this.prisma.aiReviewJob.create({
      data: {
        tenantId,
        cardId,
        requestedBy: userId,
        reviewType,
        status: "processing",
        currentStep: 0,
        selectedDocumentIds:
          documentIds as Prisma.InputJsonValue,
      },
      select: {
        id: true,
      },
    });

    if (this.autoProcess) {
      void this.processAsync(job.id);
    }

    return {
      jobId: job.id,
    };
  }

  private async loadInput(job: AiReviewJob) {
    const documentIds = stringArray(
      job.selectedDocumentIds,
    );

    const [card, requirements, vaultDocuments] =
      await Promise.all([
        this.prisma.workspaceCard.findFirst({
          where: {
            id: job.cardId,
            tenantId: job.tenantId,
          },
          include: {
            tender: {
              select: {
                title: true,
              },
            },
          },
        }),
        this.prisma.requirement.findMany({
          where: {
            cardId: job.cardId,
          },
          select: {
            name: true,
            status: true,
          },
          orderBy: {
            sortOrder: "asc",
          },
        }),
        this.prisma.vaultDocument.findMany({
          where: {
            tenantId: job.tenantId,
            id: {
              in: documentIds,
            },
          },
          select: {
            id: true,
            name: true,
            status: true,
            expiresAt: true,
          },
          orderBy: {
            id: "asc",
          },
        }),
      ]);

    if (!card) {
      throw new AiReviewAccessError(
        "Bid no longer exists.",
        404,
      );
    }

    return {
      bidTitle: card.tender.title,
      requirements,
      vaultDocuments,
    };
  }

  async processNow(jobId: string): Promise<void> {
    const job = await this.prisma.aiReviewJob.findUnique({
      where: {
        id: jobId,
      },
    });

    if (!job || job.status !== "processing") {
      return;
    }

    if (job.currentStep < REVIEW_STEPS.length) {
      await this.prisma.aiReviewJob.updateMany({
        where: {
          id: job.id,
          status: "processing",
          currentStep: job.currentStep,
        },
        data: {
          currentStep: job.currentStep + 1,
        },
      });

      return;
    }

    const input = await this.loadInput(job);
    const output = await this.analyzer.analyze(
      input,
      job.reviewType as ReviewType,
    );

    await this.prisma.aiReviewJob.updateMany({
      where: {
        id: job.id,
        status: "processing",
        currentStep: REVIEW_STEPS.length,
      },
      data: {
        status: "complete",
        score: output.score,
        findings:
          output.findings as unknown as
            Prisma.InputJsonValue,
        missingDocuments:
          output.missingDocuments as
            Prisma.InputJsonValue,
        error: null,
      },
    });
  }

  private async processAsync(jobId: string): Promise<void> {
    try {
      for (
        let step = 0;
        step <= REVIEW_STEPS.length;
        step += 1
      ) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, this.stepDelayMs);
        });

        await this.processNow(jobId);
      }
    } catch (error) {
      await this.prisma.aiReviewJob.updateMany({
        where: {
          id: jobId,
          status: "processing",
        },
        data: {
          status: "failed",
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
      });
    }
  }

  private toStatus(job: AiReviewJob): JobStatusDto {
    const status = job.status as ReviewStatus;

    return {
      jobId: job.id,
      cardId: job.cardId,
      reviewType: job.reviewType as ReviewType,
      status,
      currentStep: job.currentStep,
      activeStepLabel:
        status === "processing" &&
        job.currentStep < REVIEW_STEPS.length
          ? REVIEW_STEPS[job.currentStep]
          : null,
      score: job.score,
      error: job.error,
    };
  }

  async status(
    tenantId: string,
    userId: string,
    jobId: string,
  ): Promise<JobStatusDto> {
    const job = await this.requireJob(
      tenantId,
      userId,
      jobId,
    );

    return this.toStatus(job);
  }

  async findings(
    tenantId: string,
    userId: string,
    jobId: string,
  ): Promise<JobResult> {
    const job = await this.requireJob(
      tenantId,
      userId,
      jobId,
    );

    if (job.status !== "complete") {
      throw new AiReviewAccessError(
        "AI review is not complete.",
        409,
      );
    }

    return {
      ...this.toStatus(job),
      findings: findingsArray(job.findings),
      missingDocuments: stringArray(
        job.missingDocuments,
      ),
    };
  }

  async report(
    tenantId: string,
    userId: string,
    jobId: string,
  ): Promise<{
    filename: string;
    body: string;
  }> {
    const result = await this.findings(
      tenantId,
      userId,
      jobId,
    );

    const findingLines = result.findings.map(
      (finding) =>
        `[${finding.severity}] ${finding.title}\n` +
        `  ${finding.summary}\n` +
        `  Fix: ${finding.fix}`,
    );

    return {
      filename: `ai-review-${jobId}.txt`,
      body: [
        `AI Bid Readiness Review - ${result.reviewType}`,
        `Score: ${result.score ?? "-"}/100`,
        "",
        ...findingLines,
      ].join("\n"),
    };
  }
}
