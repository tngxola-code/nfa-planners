import { prisma } from '../config/database';

export async function createTenant(name: string) {
  return prisma.tenant.create({ data: { name } });
}

export async function getMembers(tenantId: string) {
  return prisma.member.findMany({ where: { tenantId }, include: { user: true } });
}
