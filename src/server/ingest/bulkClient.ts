import { normaliseRelease } from "@/lib/ocds/normalise";
import { isOcdsRelease } from "@/lib/ocds/types";
import type { OcdsRelease } from "@/lib/ocds/types";
import { getPrismaClient } from "@/lib/prisma";

const DOWNLOAD_PAGE = "https://data.etenders.gov.za/Home/ReleasesFiles";

export async function fetchMonthlyFilesList(): Promise<{ year: number; month: number; url: string }[]> {
  const response = await fetch(DOWNLOAD_PAGE);
  const html = await response.text();
  const linkRegex = /<a[^>]+href="([^"]+\.json)"[^>]*>/gi;
  const matches = Array.from(html.matchAll(linkRegex));
  const urls = matches.map(m => m[1]);
  const base = "https://data.etenders.gov.za";
  const fullUrls = urls.map(url => url.startsWith("http") ? url : base + url);

  return fullUrls.map(url => {
    const match = url.match(/Release_(\d{4})-(\d{2})\.json/);
    if (match) {
      return { year: parseInt(match[1]), month: parseInt(match[2]), url };
    }
    return null;
  }).filter(Boolean) as { year: number; month: number; url: string }[];
}

async function processRelease(release: OcdsRelease, source: string) {
  const prisma = getPrismaClient();
  const now = new Date();
  const opp = normaliseRelease(release, now);
  if (!opp) return;

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

  let status = opp.status;
  let awardee: string | undefined;
  let awardAmount: number | undefined;
  let awardCurrency: string | undefined;

  if (release.awards && release.awards.length > 0) {
    const activeAward = release.awards.find(a => a.status === "active");
    if (activeAward) {
      status = "awarded";
      const supplier = activeAward.suppliers?.[0]?.name;
      if (supplier) awardee = supplier;
      if (activeAward.value) {
        awardAmount = activeAward.value.amount;
        awardCurrency = activeAward.value.currency;
      }
    }
  }

  if (release.tender && release.tender.status === "cancelled") {
    status = "cancelled";
  }

  await prisma.opportunityHistory.create({
    data: {
      opportunityHash: opp.hash,
      status,
      statusChangedAt: now,
      awardee,
      awardAmount,
      awardCurrency,
      source,
      rawData: release as any,
    },
  });
}

export async function processNewMonthlyFiles() {
  const prisma = getPrismaClient();
  const files = await fetchMonthlyFilesList();
  const existing = await prisma.monthlyFile.findMany({
    select: { fileUrl: true },
  });
  const existingUrls = new Set(existing.map((f: { fileUrl: string }) => f.fileUrl));

  for (const file of files) {
    if (existingUrls.has(file.url)) continue;
    const response = await fetch(file.url);
    const json = await response.json();
    const releases = json.releases || [];
    let count = 0;
    for (const release of releases) {
      if (!isOcdsRelease(release)) continue;
      await processRelease(release, "BULK");
      count++;
    }
    await prisma.monthlyFile.create({
      data: {
        year: file.year,
        month: file.month,
        fileUrl: file.url,
        recordCount: count,
      },
    });
  }
}
