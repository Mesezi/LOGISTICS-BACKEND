import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ClientsModule } from './clients/clients.module.js';
import { RidersModule } from './riders/riders.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { ExpensesModule } from './expenses/expenses.module.js';
import { UsersModule } from './users/users.module.js';
import { AuditLogsModule } from './audit-logs/audit-logs.module.js';
import { SearchModule } from './search/search.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { AccountsModule } from './accounts/accounts.module.js';
import { PartnersModule } from './partners/partners.module.js';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth/auth.guard.js';

@Module({
    imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    ClientsModule,
    UsersModule,
    RidersModule,
    JobsModule,
    PaymentsModule,
    ExpensesModule,
    AuditLogsModule,
    SearchModule,
    ReportsModule,
    AccountsModule,
    PartnersModule,
  ],
  controllers: [AppController],
  providers: [AppService, {
      provide: APP_GUARD,
      useExisting: AuthGuard,
    }],
})
export class AppModule {}
