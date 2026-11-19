import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ClientStatementDto } from './dto/client-statement.dto.js';
import type { DailyReportDto } from './dto/daily-report.dto.js';
import type { ListReportItemsDto } from './dto/list-report-items.dto.js';
import type { ReportDateRangeDto } from './dto/report-date-range.dto.js';

type Numeric = number | bigint | null;
type ReportRow = Record<string, Numeric | string | Date | null>;

function numberValue(value: Numeric): number {
  return Number(value ?? 0);
}

function rangeDates(query: ReportDateRangeDto) {
  if (
    query.start_date &&
    query.end_date &&
    query.start_date > query.end_date
  ) {
    throw new BadRequestException(
      'start_date must be before or equal to end_date',
    );
  }
  return { startDate: query.start_date ?? null, endDate: query.end_date ?? null };
}

function lagosDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function mapTotals(row: ReportRow | undefined, fields: string[]) {
  return Object.fromEntries(
    fields.map((field) => [field, numberValue(row?.[field] as Numeric)]),
  );
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async dailyExcel(user: AuthenticatedUser, query: DailyReportDto) {
    const date = query.date ?? lagosDate();
    const day = new Date(`${date}T00:00:00.000Z`);
    const [payments, expenses] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          paid_at: day,
          job: { account_id: user.accountId },
        },
        include: {
          job: {
            include: {
              client: { select: { name: true } },
              rider: { select: { name: true } },
              partner: { select: { name: true } },
            },
          },
        },
        orderBy: { id: 'asc' },
      }),
      this.prisma.expense.findMany({
        where: { account_id: user.accountId, expense_date: day },
        include: {
          rider: { select: { name: true } },
          client: { select: { name: true } },
          job: {
            include: {
              client: { select: { name: true } },
              rider: { select: { name: true } },
              partner: { select: { name: true } },
            },
          },
        },
        orderBy: { id: 'asc' },
      }),
    ]);

    type SheetRow = {
      clientName: string;
      route: string;
      income: number;
      paymentModes: Set<string>;
      riderName: string;
      riderIncome: number;
      sublet: number;
      park: number;
      officeIncome: number;
      partnerName: string;
      partnerAmount: number;
      expenseDescriptions: string[];
      expenseModes: Set<string>;
      riderExpenses: number;
      officeExpenses: number;
      partnerExpenses: number;
    };

    const rowsByJob = new Map<number, SheetRow>();
    const newRow = (
      job?: (typeof payments)[number]['job'] | NonNullable<(typeof expenses)[number]['job']>,
    ): SheetRow => ({
      clientName: job
        ? job.sublet_name
          ? `Commission (${job.client.name})`
          : job.client.name
        : '',
      route: job ? `${job.pickup} → ${job.dropoff}` : '',
      income: 0,
      paymentModes: new Set<string>(),
      riderName: job?.rider?.name ?? '',
      riderIncome: job?.rider_id && !job.sublet_name ? job.office_fee : 0,
      sublet: job?.sublet_amount ?? 0,
      park: job?.park_waybill ?? 0,
      officeIncome:
        job && (!job.rider_id || job.sublet_name) ? job.office_fee : 0,
      partnerName: job?.partner?.name ?? job?.partner_name_snapshot ?? '',
      partnerAmount: job?.partner_amount ?? 0,
      expenseDescriptions: [],
      expenseModes: new Set<string>(),
      riderExpenses: 0,
      officeExpenses: 0,
      partnerExpenses: 0,
    });

    const getJobRow = (
      job: (typeof payments)[number]['job'] | NonNullable<(typeof expenses)[number]['job']>,
    ) => {
      let row = rowsByJob.get(job.id);
      if (!row) {
        row = newRow(job);
        rowsByJob.set(job.id, row);
      }
      return row;
    };

    for (const payment of payments) {
      const row = getJobRow(payment.job);
      row.income += payment.type === 'payment' ? payment.amount : -payment.amount;
      row.paymentModes.add(
        payment.mode === 'transfer'
          ? payment.bank_name?.trim() || 'Transfer'
          : 'Cash',
      );
    }

    const unlinkedExpenses: typeof expenses = [];
    for (const expense of expenses) {
      if (!expense.job) {
        unlinkedExpenses.push(expense);
        continue;
      }
      const row = getJobRow(expense.job);
      row.expenseDescriptions.push(expense.description);
      row.expenseModes.add(
        expense.mode === 'transfer'
          ? expense.bank_name?.trim() || 'Transfer'
          : 'Cash',
      );
      if (expense.owner === 'rider') row.riderExpenses += expense.amount;
      else if (expense.owner === 'office') row.officeExpenses += expense.amount;
      else row.partnerExpenses += expense.amount;
    }

    if (unlinkedExpenses.length > 0) {
      const row = newRow();
      for (const expense of unlinkedExpenses) {
        const ownerName =
          expense.owner === 'rider'
            ? expense.rider?.name
            : expense.owner === 'client'
              ? expense.client?.name
              : undefined;
        row.expenseDescriptions.push(
          ownerName
            ? `${expense.description} (${ownerName})`
            : expense.description,
        );
        row.expenseModes.add(
          expense.mode === 'transfer'
            ? expense.bank_name?.trim() || 'Transfer'
            : 'Cash',
        );
        if (expense.owner === 'rider') row.riderExpenses += expense.amount;
        else if (expense.owner === 'office') row.officeExpenses += expense.amount;
        else row.partnerExpenses += expense.amount;
      }
      rowsByJob.set(-1, row);
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Daily Sheet');
    worksheet.addRow([
      'Date',
      'Client name',
      'Route',
      'Income',
      'Mode of payment',
      'Rider',
      'Rider income',
      'Sublet',
      'Park',
      'Office income',
      'Partner',
      'Partner amount',
      'Description of expenses',
      'Expense mode',
      'Rider expenses',
      'Office expenses',
      'Partner/client expenses',
    ]);

    for (const row of rowsByJob.values()) {
      worksheet.addRow([
        date,
        row.clientName,
        row.route,
        row.income,
        [...row.paymentModes].join(', '),
        row.riderName,
        row.riderIncome,
        row.sublet,
        row.park,
        row.officeIncome,
        row.partnerName,
        row.partnerAmount,
        row.expenseDescriptions.join(', '),
        [...row.expenseModes].join(', '),
        row.riderExpenses,
        row.officeExpenses,
        row.partnerExpenses,
      ]);
    }

    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    worksheet.columns.forEach((column) => {
      column.width = 18;
    });
    worksheet.getColumn('B').width = 28;
    worksheet.getColumn('C').width = 28;
    worksheet.getColumn('M').width = 40;
    worksheet.getColumn('E').width = 24;
    worksheet.getColumn('N').width = 24;
    for (const column of ['D', 'G', 'H', 'I', 'J', 'L', 'O', 'P', 'Q']) {
      worksheet.getColumn(column).numFmt = '#,##0;[Red]-#,##0';
    }

    const output = await workbook.xlsx.writeBuffer();
    return { date, buffer: Buffer.from(output) };
  }

  async daily(user: AuthenticatedUser, query: DailyReportDto) {
    const date = query.date ?? lagosDate();
    const [row] = await this.prisma.$queryRaw<ReportRow[]>`
      SELECT
        (SELECT COUNT(*) FROM "jobs" j
         WHERE j.account_id = ${user.accountId} AND j.job_date = ${date}::date) AS "jobCount",
        (SELECT COUNT(*) FROM "jobs" j
         WHERE j.account_id = ${user.accountId} AND j.job_date = ${date}::date
           AND j.status = 'delivered') AS "deliveredJobs",
        (SELECT COUNT(*) FROM "jobs" j
         WHERE j.account_id = ${user.accountId} AND j.job_date = ${date}::date
           AND j.status = 'failed') AS "failedJobs",
        (SELECT COUNT(*) FROM "jobs" j
         WHERE j.account_id = ${user.accountId} AND j.job_date = ${date}::date
           AND j.status = 'cancelled') AS "cancelledJobs",
        (SELECT COALESCE(SUM(j.office_fee), 0)
         FROM "jobs" j
         WHERE j.account_id = ${user.accountId} AND j.job_date = ${date}::date
           AND j.status <> 'cancelled') AS "officeFees",
        (SELECT COALESCE(SUM(j.sublet_amount), 0)
         FROM "jobs" j
         WHERE j.account_id = ${user.accountId} AND j.job_date = ${date}::date
           AND j.status <> 'cancelled') AS "subletFees",
        (SELECT COALESCE(SUM(j.partner_amount + j.park_waybill), 0)
         FROM "jobs" j
         WHERE j.account_id = ${user.accountId} AND j.job_date = ${date}::date
           AND j.status <> 'cancelled') AS "partnerAndWaybillFees",
        (SELECT COALESCE(SUM(CASE WHEN p.type = 'payment' THEN p.amount ELSE 0 END), 0)
         FROM "payments" p
         INNER JOIN "jobs" j ON j.id = p.job_id
         WHERE j.account_id = ${user.accountId} AND p.paid_at = ${date}::date) AS "paymentsReceived",
        (SELECT COALESCE(SUM(CASE WHEN p.type = 'refund' THEN p.amount ELSE 0 END), 0)
         FROM "payments" p
         INNER JOIN "jobs" j ON j.id = p.job_id
         WHERE j.account_id = ${user.accountId} AND p.paid_at = ${date}::date) AS "refundsIssued",
        (SELECT COALESCE(SUM(e.amount), 0)
         FROM "expenses" e
         WHERE e.account_id = ${user.accountId} AND e.expense_date = ${date}::date) AS "expenses"
    `;

    return {
      date,
      ...mapTotals(row, [
        'jobCount',
        'deliveredJobs',
        'failedJobs',
        'cancelledJobs',
        'officeFees',
        'subletFees',
        'partnerAndWaybillFees',
        'paymentsReceived',
        'refundsIssued',
        'expenses',
      ]),
    };
  }

  async income(user: AuthenticatedUser, query: ReportDateRangeDto) {
    const { startDate, endDate } = rangeDates(query);
    const [row] = await this.prisma.$queryRaw<ReportRow[]>`
      SELECT COUNT(*) AS "jobCount", COALESCE(SUM(j.office_fee), 0) AS "officeFees"
      FROM "jobs" j
      WHERE j.account_id = ${user.accountId}
        AND j.status <> 'cancelled'
        AND (${startDate}::date IS NULL OR j.job_date >= ${startDate}::date)
        AND (${endDate}::date IS NULL OR j.job_date <= ${endDate}::date)
    `;
    return mapTotals(row, ['jobCount', 'officeFees']);
  }

  async riders(user: AuthenticatedUser, query: ReportDateRangeDto) {
    const { startDate, endDate } = rangeDates(query);
    const rows = await this.prisma.$queryRaw<ReportRow[]>`
      WITH job_totals AS (
        SELECT j.rider_id,
          COUNT(*) AS "jobCount",
          COUNT(*) FILTER (WHERE j.status = 'delivered') AS "deliveredJobs",
          COUNT(*) FILTER (WHERE j.status = 'failed') AS "failedJobs",
          COALESCE(SUM(j.office_fee), 0) AS "officeFees"
        FROM "jobs" j
        WHERE j.account_id = ${user.accountId}
          AND j.rider_id IS NOT NULL
          AND j.status <> 'cancelled'
          AND (${startDate}::date IS NULL OR j.job_date >= ${startDate}::date)
          AND (${endDate}::date IS NULL OR j.job_date <= ${endDate}::date)
        GROUP BY j.rider_id
      ),
      expense_totals AS (
        SELECT e.rider_id, COALESCE(SUM(e.amount), 0) AS "riderExpenses"
        FROM "expenses" e
        WHERE e.account_id = ${user.accountId}
          AND e.owner = 'rider'
          AND e.rider_id IS NOT NULL
          AND (${startDate}::date IS NULL OR e.expense_date >= ${startDate}::date)
          AND (${endDate}::date IS NULL OR e.expense_date <= ${endDate}::date)
        GROUP BY e.rider_id
      )
      SELECT r.id AS "riderId", r.name,
        COALESCE(j."jobCount", 0) AS "jobCount",
        COALESCE(j."deliveredJobs", 0) AS "deliveredJobs",
        COALESCE(j."failedJobs", 0) AS "failedJobs",
        COALESCE(j."officeFees", 0) AS "officeFees",
        COALESCE(e."riderExpenses", 0) AS "riderExpenses"
      FROM "riders" r
      LEFT JOIN job_totals j ON j.rider_id = r.id
      LEFT JOIN expense_totals e ON e.rider_id = r.id
      WHERE r.account_id = ${user.accountId}
      ORDER BY r.name ASC
    `;
    return {
      data: rows.map((row) => ({
        riderId: numberValue(row.riderId as Numeric),
        name: row.name,
        ...mapTotals(row, [
          'jobCount',
          'deliveredJobs',
          'failedJobs',
          'officeFees',
          'riderExpenses',
        ]),
      })),
    };
  }

  async sublets(user: AuthenticatedUser, query: ReportDateRangeDto) {
    const { startDate, endDate } = rangeDates(query);
    const rows = await this.prisma.$queryRaw<ReportRow[]>`
      SELECT j.sublet_name AS name, COUNT(*) AS "jobCount",
        COALESCE(SUM(j.sublet_amount), 0) AS amount
      FROM "jobs" j
      WHERE j.account_id = ${user.accountId}
        AND j.status <> 'cancelled'
        AND j.sublet_name IS NOT NULL
        AND (${startDate}::date IS NULL OR j.job_date >= ${startDate}::date)
        AND (${endDate}::date IS NULL OR j.job_date <= ${endDate}::date)
      GROUP BY j.sublet_name
      ORDER BY amount DESC, name ASC
    `;
    const data = rows.map((row) => ({
      name: row.name as string | null,
      jobCount: numberValue(row.jobCount as Numeric),
      amount: numberValue(row.amount as Numeric),
    }));
    return {
      data,
      totals: {
        jobCount: data.reduce((sum, item) => sum + item.jobCount, 0),
        amount: data.reduce((sum, item) => sum + item.amount, 0),
      },
    };
  }

  async partners(user: AuthenticatedUser, query: ReportDateRangeDto) {
    const { startDate, endDate } = rangeDates(query);
    const rows = await this.prisma.$queryRaw<ReportRow[]>`
      SELECT p.id AS "partnerId", p.name, COUNT(*) AS "jobCount",
        COALESCE(SUM(j.partner_amount), 0) AS amount
      FROM "jobs" j
      INNER JOIN "partners" p ON p.id = j.partner_id
      WHERE j.account_id = ${user.accountId}
        AND j.status <> 'cancelled'
        AND j.partner_id IS NOT NULL
        AND (${startDate}::date IS NULL OR j.job_date >= ${startDate}::date)
        AND (${endDate}::date IS NULL OR j.job_date <= ${endDate}::date)
      GROUP BY p.id, p.name
      ORDER BY amount DESC, p.name ASC
    `;
    const data = rows.map((row) => ({
      partnerId: numberValue(row.partnerId as Numeric),
      name: row.name as string | null,
      jobCount: numberValue(row.jobCount as Numeric),
      amount: numberValue(row.amount as Numeric),
    }));
    return {
      data,
      totals: {
        jobCount: data.reduce((sum, item) => sum + item.jobCount, 0),
        amount: data.reduce((sum, item) => sum + item.amount, 0),
      },
    };
  }

  async failedJobs(user: AuthenticatedUser, query: ListReportItemsDto) {
    const { startDate, endDate } = rangeDates(query);
    const skip = (query.page - 1) * query.limit;
    const [rows, countRows, totalRows] = await Promise.all([
      this.prisma.$queryRaw<ReportRow[]>`
        WITH expense_totals AS (
          SELECT job_id, COALESCE(SUM(amount), 0) AS amount
          FROM "expenses"
          WHERE account_id = ${user.accountId} AND job_id IS NOT NULL
          GROUP BY job_id
        )
        SELECT j.id, j.job_date AS date, j.status, j.pickup, j.dropoff,
          j.office_fee AS "officeFee", c.id AS "clientId", c.name AS "clientName",
          COALESCE(e.amount, 0) AS expenses,
          j.office_fee - COALESCE(e.amount, 0) AS "netOutcome"
        FROM "jobs" j
        INNER JOIN "clients" c ON c.id = j.client_id
        LEFT JOIN expense_totals e ON e.job_id = j.id
        WHERE j.account_id = ${user.accountId}
          AND j.status IN ('failed', 'cancelled')
          AND (${startDate}::date IS NULL OR j.job_date >= ${startDate}::date)
          AND (${endDate}::date IS NULL OR j.job_date <= ${endDate}::date)
        ORDER BY j.job_date DESC, j.id DESC
        LIMIT ${query.limit} OFFSET ${skip}
      `,
      this.prisma.$queryRaw<ReportRow[]>`
        SELECT COUNT(*) AS total
        FROM "jobs" j
        WHERE j.account_id = ${user.accountId}
          AND j.status IN ('failed', 'cancelled')
          AND (${startDate}::date IS NULL OR j.job_date >= ${startDate}::date)
          AND (${endDate}::date IS NULL OR j.job_date <= ${endDate}::date)
      `,
      this.prisma.$queryRaw<ReportRow[]>`
        SELECT COALESCE(SUM(j.office_fee), 0) AS "officeFees",
          COALESCE(SUM(COALESCE(e.amount, 0)), 0) AS expenses,
          COALESCE(SUM(j.office_fee - COALESCE(e.amount, 0)), 0) AS "netOutcome"
        FROM "jobs" j
        LEFT JOIN (
          SELECT job_id, SUM(amount) AS amount
          FROM "expenses"
          WHERE account_id = ${user.accountId} AND job_id IS NOT NULL
          GROUP BY job_id
        ) e ON e.job_id = j.id
        WHERE j.account_id = ${user.accountId}
          AND j.status IN ('failed', 'cancelled')
          AND (${startDate}::date IS NULL OR j.job_date >= ${startDate}::date)
          AND (${endDate}::date IS NULL OR j.job_date <= ${endDate}::date)
      `,
    ]);

    const total = numberValue(countRows[0]?.total as Numeric);
    return {
      data: rows.map((row) => ({
        id: numberValue(row.id as Numeric),
        date: row.date,
        status: row.status,
        pickup: row.pickup,
        dropoff: row.dropoff,
        client: { id: row.clientId, name: row.clientName },
        ...mapTotals(row, ['officeFee', 'expenses', 'netOutcome']),
      })),
      totals: mapTotals(totalRows[0], ['officeFees', 'expenses', 'netOutcome']),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
        hasNextPage: query.page * query.limit < total,
        hasPreviousPage: query.page > 1,
      },
    };
  }

  async debts(user: AuthenticatedUser, query: ListReportItemsDto) {
    const { startDate, endDate } = rangeDates(query);
    const skip = (query.page - 1) * query.limit;
    const [rows, countRows, totalRows] = await Promise.all([
      this.prisma.$queryRaw<ReportRow[]>`
        WITH received AS (
          SELECT job_id,
            SUM(CASE WHEN type = 'payment' THEN amount ELSE -amount END) AS amount
          FROM "payments"
          GROUP BY job_id
        )
        SELECT j.id, j.job_date AS date, j.status, j.total,
          COALESCE(p.amount, 0) AS received,
          j.total - COALESCE(p.amount, 0) AS balance,
          c.id AS "clientId", c.name AS "clientName",
          r.id AS "riderId", r.name AS "riderName"
        FROM "jobs" j
        INNER JOIN "clients" c ON c.id = j.client_id
        LEFT JOIN "riders" r ON r.id = j.rider_id
        LEFT JOIN received p ON p.job_id = j.id
        WHERE j.account_id = ${user.accountId}
          AND j.status <> 'cancelled'
          AND j.total - COALESCE(p.amount, 0) > 0
          AND (${startDate}::date IS NULL OR j.job_date >= ${startDate}::date)
          AND (${endDate}::date IS NULL OR j.job_date <= ${endDate}::date)
        ORDER BY j.job_date ASC, j.id ASC
        LIMIT ${query.limit} OFFSET ${skip}
      `,
      this.prisma.$queryRaw<ReportRow[]>`
        WITH received AS (
          SELECT job_id,
            SUM(CASE WHEN type = 'payment' THEN amount ELSE -amount END) AS amount
          FROM "payments"
          GROUP BY job_id
        )
        SELECT COUNT(*) AS total
        FROM "jobs" j
        LEFT JOIN received p ON p.job_id = j.id
        WHERE j.account_id = ${user.accountId}
          AND j.status <> 'cancelled'
          AND j.total - COALESCE(p.amount, 0) > 0
          AND (${startDate}::date IS NULL OR j.job_date >= ${startDate}::date)
          AND (${endDate}::date IS NULL OR j.job_date <= ${endDate}::date)
      `,
      this.prisma.$queryRaw<ReportRow[]>`
        WITH received AS (
          SELECT job_id,
            SUM(CASE WHEN type = 'payment' THEN amount ELSE -amount END) AS amount
          FROM "payments"
          GROUP BY job_id
        )
        SELECT COUNT(*) AS "jobCount",
          COALESCE(SUM(j.total), 0) AS "totalBilled",
          COALESCE(SUM(COALESCE(p.amount, 0)), 0) AS received,
          COALESCE(SUM(j.total - COALESCE(p.amount, 0)), 0) AS balance
        FROM "jobs" j
        LEFT JOIN received p ON p.job_id = j.id
        WHERE j.account_id = ${user.accountId}
          AND j.status <> 'cancelled'
          AND j.total - COALESCE(p.amount, 0) > 0
          AND (${startDate}::date IS NULL OR j.job_date >= ${startDate}::date)
          AND (${endDate}::date IS NULL OR j.job_date <= ${endDate}::date)
      `,
    ]);

    const total = numberValue(countRows[0]?.total as Numeric);
    return {
      data: rows.map((row) => ({
        id: numberValue(row.id as Numeric),
        date: row.date,
        status: row.status,
        client: { id: row.clientId, name: row.clientName },
        rider: row.riderId
          ? { id: row.riderId, name: row.riderName }
          : null,
        ...mapTotals(row, ['total', 'received', 'balance']),
      })),
      totals: mapTotals(totalRows[0], [
        'jobCount',
        'totalBilled',
        'received',
        'balance',
      ]),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
        hasNextPage: query.page * query.limit < total,
        hasPreviousPage: query.page > 1,
      },
    };
  }

  async clientStatement(user: AuthenticatedUser, query: ClientStatementDto) {
    const { startDate, endDate } = rangeDates(query);
    const client = await this.prisma.client.findFirst({
      where: { id: query.client_id, account_id: user.accountId },
      select: { id: true, name: true, phone: true },
    });
    if (!client) throw new NotFoundException('Client not found');

    const entries = await this.prisma.$queryRaw<ReportRow[]>`
      WITH ledger AS (
        SELECT j.job_date AS date, 'job'::text AS type,
          j.id AS "recordId", 'Job charge'::text AS description,
          j.total AS amount, j.total AS "balanceChange", j.id AS tie_breaker
        FROM "jobs" j
        WHERE j.account_id = ${user.accountId}
          AND j.client_id = ${query.client_id}
          AND j.status <> 'cancelled'

        UNION ALL

        SELECT p.paid_at AS date, p.type::text AS type,
          p.id AS "recordId",
          CASE WHEN p.type = 'refund' THEN 'Refund' ELSE 'Payment' END AS description,
          p.amount,
          CASE WHEN p.type = 'refund' THEN p.amount ELSE -p.amount END AS "balanceChange",
          p.id AS tie_breaker
        FROM "payments" p
        INNER JOIN "jobs" j ON j.id = p.job_id
        WHERE j.account_id = ${user.accountId}
          AND j.client_id = ${query.client_id}
          AND j.status <> 'cancelled'

        UNION ALL

        SELECT e.expense_date AS date, 'expense'::text AS type,
          e.id AS "recordId", e.description, e.amount, 0 AS "balanceChange",
          e.id AS tie_breaker
        FROM "expenses" e
        WHERE e.account_id = ${user.accountId}
          AND e.client_id = ${query.client_id}
          AND e.owner = 'client'
      )
      SELECT date, type, "recordId", description, amount, "balanceChange"
      FROM ledger
      WHERE (${startDate}::date IS NULL OR date >= ${startDate}::date)
        AND (${endDate}::date IS NULL OR date <= ${endDate}::date)
      ORDER BY date ASC, tie_breaker ASC, type ASC
    `;

    const [openingRows] = startDate
      ? await this.prisma.$queryRaw<ReportRow[]>`
          WITH ledger AS (
            SELECT j.total AS change
            FROM "jobs" j
            WHERE j.account_id = ${user.accountId}
              AND j.client_id = ${query.client_id}
              AND j.status <> 'cancelled'
              AND j.job_date < ${startDate}::date
            UNION ALL
            SELECT CASE WHEN p.type = 'refund' THEN p.amount ELSE -p.amount END AS change
            FROM "payments" p
            INNER JOIN "jobs" j ON j.id = p.job_id
            WHERE j.account_id = ${user.accountId}
              AND j.client_id = ${query.client_id}
              AND j.status <> 'cancelled'
              AND p.paid_at < ${startDate}::date
          )
          SELECT COALESCE(SUM(change), 0) AS balance
          FROM ledger
        `
      : [{ balance: 0 }];

    const openingBalance = numberValue(openingRows.balance as Numeric);
    const jobCharges = entries
      .filter((entry) => entry.type === 'job')
      .reduce((sum, entry) => sum + numberValue(entry.amount as Numeric), 0);
    const payments = entries
      .filter((entry) => entry.type === 'payment')
      .reduce((sum, entry) => sum + numberValue(entry.amount as Numeric), 0);
    const refunds = entries
      .filter((entry) => entry.type === 'refund')
      .reduce((sum, entry) => sum + numberValue(entry.amount as Numeric), 0);
    const expenses = entries
      .filter((entry) => entry.type === 'expense')
      .reduce((sum, entry) => sum + numberValue(entry.amount as Numeric), 0);
    const periodBalanceChange = entries.reduce(
      (sum, entry) => sum + numberValue(entry.balanceChange as Numeric),
      0,
    );

    return {
      client,
      period: { start_date: startDate, end_date: endDate },
      summary: {
        openingBalance,
        jobCharges,
        payments,
        refunds,
        expenses,
        closingBalance: openingBalance + periodBalanceChange,
      },
      data: entries.map((entry) => ({
        date: entry.date,
        type: entry.type,
        recordId: numberValue(entry.recordId as Numeric),
        description: entry.description,
        amount: numberValue(entry.amount as Numeric),
        balanceChange: numberValue(entry.balanceChange as Numeric),
      })),
    };
  }
}
