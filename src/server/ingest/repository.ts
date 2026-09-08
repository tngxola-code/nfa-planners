import type { Opportunity } from "@/lib/ocds/types";
import { prisma } from "@/server/db";

export const opportunityRepository = {
  async upsert(opp: Opportunity): Promise<void> {
    await prisma.opportunity.upsert({
      where: { hash: opp.hash },
      update: {
        reference: opp.reference,
        title: opp.title,
        description: opp.description,
        client: opp.client,
        location: opp.location,
        province: opp.province,
        category: opp.category,
        closingDate: new Date(opp.closingDate),
        publishedDate: opp.publishedDate ? new Date(opp.publishedDate) : undefined,
        source: opp.source,
        sourceUrl: opp.sourceUrl,
        documentUrls: opp.documentUrls,
        estimatedValue: opp.estimatedValue,
        contactEmail: opp.contactEmail,
        contactPhone: opp.contactPhone,
        fitScore: opp.fitScore,
        fitReason: opp.fitReason,
        status: opp.status,
        notifiedAt: opp.notifiedAt ? new Date(opp.notifiedAt) : undefined,
      },
      create: {
        id: opp.id,
        reference: opp.reference,
        title: opp.title,
        description: opp.description,
        client: opp.client,
        location: opp.location,
        province: opp.province,
        category: opp.category,
        closingDate: new Date(opp.closingDate),
        publishedDate: opp.publishedDate ? new Date(opp.publishedDate) : undefined,
        source: opp.source,
        sourceUrl: opp.sourceUrl,
        documentUrls: opp.documentUrls,
        estimatedValue: opp.estimatedValue,
        contactEmail: opp.contactEmail,
        contactPhone: opp.contactPhone,
        fitScore: opp.fitScore,
        fitReason: opp.fitReason,
        hash: opp.hash,
        status: opp.status,
        ingestedAt: new Date(opp.ingestedAt),
        notifiedAt: opp.notifiedAt ? new Date(opp.notifiedAt) : undefined,
      },
    });
  },

  async closePastDeadlines(now: Date): Promise<void> {
    await prisma.opportunity.updateMany({
      where: {
        closingDate: { lt: now },
        status: "active",
      },
      data: { status: "closed" },
    });
  },
};
