import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';

type SuggestionRow = {
  name: string;
  usage_count: bigint;
};

const SUGGESTION_LIMIT = 10;

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async banks(user: AuthenticatedUser, query: string) {
    const term = query.trim().toLowerCase();
    if (!term) return { data: [] };

    const rows = await this.prisma.$queryRaw<SuggestionRow[]>`
      WITH bank_values AS (
        SELECT p.bank_name AS value
        FROM "payments" p
        INNER JOIN "jobs" j ON j.id = p.job_id
        WHERE j.account_id = ${user.accountId}
          AND p.mode = 'transfer'
          AND p.bank_name IS NOT NULL

        UNION ALL

        SELECT e.bank_name AS value
        FROM "expenses" e
        WHERE e.account_id = ${user.accountId}
          AND e.mode = 'transfer'
          AND e.bank_name IS NOT NULL
      ),
      matched AS (
        SELECT btrim(value) AS value
        FROM bank_values
        WHERE btrim(value) <> ''
          AND position(${term} in lower(btrim(value))) > 0
      )
      SELECT MIN(value) AS name, COUNT(*) AS usage_count
      FROM matched
      GROUP BY lower(value)
      ORDER BY usage_count DESC, name ASC
      LIMIT ${SUGGESTION_LIMIT}
    `;

    return { data: rows.map(({ name, usage_count }) => ({ name, usageCount: Number(usage_count) })) };
  }

  async locations(user: AuthenticatedUser, query: string) {
    const term = query.trim().toLowerCase();
    if (!term) return { data: [] };

    const rows = await this.prisma.$queryRaw<SuggestionRow[]>`
      WITH location_values AS (
        SELECT pickup AS value
        FROM "jobs"
        WHERE account_id = ${user.accountId}

        UNION ALL

        SELECT dropoff AS value
        FROM "jobs"
        WHERE account_id = ${user.accountId}
      ),
      matched AS (
        SELECT btrim(value) AS value
        FROM location_values
        WHERE btrim(value) <> ''
          AND position(${term} in lower(btrim(value))) > 0
      )
      SELECT MIN(value) AS name, COUNT(*) AS usage_count
      FROM matched
      GROUP BY lower(value)
      ORDER BY usage_count DESC, name ASC
      LIMIT ${SUGGESTION_LIMIT}
    `;

    return { data: rows.map(({ name, usage_count }) => ({ name, usageCount: Number(usage_count) })) };
  }
}
