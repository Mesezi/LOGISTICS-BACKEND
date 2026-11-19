
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Business
  const ACCOUNT_ID = 1;

  const account = await prisma.account.upsert({
    where: { id: ACCOUNT_ID },
    update: {},
    create: {
      id: ACCOUNT_ID,
      name: 'Your Business Name',
    },
  });

  // Existing user
  const USER_ID = 1;

  await prisma.user.update({
    where: { id: USER_ID },
    data: { account_id: account.id },
  });

  // Clients
  const [client1, client2, client3] = await Promise.all([
    prisma.client.create({
      data: {
        account_id: ACCOUNT_ID,
        user_id: USER_ID,
        name: 'Acme Supplies',
        phone: '08012345678',
        notes: 'Pays on delivery',
      },
    }),
    prisma.client.create({
      data: {
        account_id: ACCOUNT_ID,
        user_id: USER_ID,
        name: 'BlueStar Logistics',
        phone: '08098765432',
      },
    }),
    prisma.client.create({
      data: {
        account_id: ACCOUNT_ID,
        user_id: USER_ID,
        name: 'Zenith Traders',
        phone: '08055556666',
        notes: 'Fragile items only',
      },
    }),
  ]);

  // Riders
  const [rider1, rider2] = await Promise.all([
    prisma.rider.create({
      data: {
        account_id: ACCOUNT_ID,
        name: 'Emeka Obi',
        phone: '08011112222',
        active: true,
      },
    }),
    prisma.rider.create({
      data: {
        account_id: ACCOUNT_ID,
        name: 'Tunde Bello',
        phone: '08033334444',
        active: true,
      },
    }),
    prisma.rider.create({
      data: {
        account_id: ACCOUNT_ID,
        name: 'Chidi Nwosu',
        phone: '08077778888',
        active: false,
      },
    }),
  ]);

  // Partners
  const [partner1, partner2, partner3] = await Promise.all([
    prisma.partner.upsert({
      where: {
        account_id_name: { account_id: ACCOUNT_ID, name: 'DHL Nigeria' },
      },
      update: {},
      create: { account_id: ACCOUNT_ID, name: 'DHL Nigeria' },
    }),
    prisma.partner.upsert({
      where: {
        account_id_name: { account_id: ACCOUNT_ID, name: 'FedEx Nigeria' },
      },
      update: {},
      create: { account_id: ACCOUNT_ID, name: 'FedEx Nigeria' },
    }),
    prisma.partner.upsert({
      where: {
        account_id_name: { account_id: ACCOUNT_ID, name: 'UPS Nigeria' },
      },
      update: {},
      create: { account_id: ACCOUNT_ID, name: 'UPS Nigeria' },
    }),
  ]);

  // Jobs
  const jobs = await Promise.all([
    // 1. Normal — delivered
    prisma.job.create({
      data: {
        account_id: ACCOUNT_ID,
        user_id: USER_ID,
        client_id: client1.id,
        rider_id: rider1.id,
        status: 'delivered',
        pickup: '14 Allen Avenue, Ikeja',
        dropoff: '5 Admiralty Way, Lekki',
        description: 'Phone accessories',
        office_fee: 1500,
        park_waybill: 200,
        total: 1700,
      },
    }),

    // 2. Normal — pending
    prisma.job.create({
      data: {
        account_id: ACCOUNT_ID,
        user_id: USER_ID,
        client_id: client2.id,
        status: 'pending',
        pickup: '7 Broad Street, Lagos Island',
        dropoff: '33 Aba Road, Port Harcourt',
        description: 'Office stationery',
        office_fee: 2000,
        total: 2000,
      },
    }),

    // 3. Normal — picked_up
    prisma.job.create({
      data: {
        account_id: ACCOUNT_ID,
        user_id: USER_ID,
        client_id: client3.id,
        rider_id: rider2.id,
        status: 'picked_up',
        pickup: '10 Awolowo Road, Ikoyi',
        dropoff: '22 Rumuola Road, Port Harcourt',
        description: 'Spare parts',
        office_fee: 2500,
        park_waybill: 500,
        total: 3000,
      },
    }),

    // 4. Normal — failed
    prisma.job.create({
      data: {
        account_id: ACCOUNT_ID,
        user_id: USER_ID,
        client_id: client1.id,
        rider_id: rider1.id,
        status: 'failed',
        pickup: '3 Marina, Lagos',
        dropoff: '15 Nnamdi Azikiwe Street, Onitsha',
        description: 'Clothing',
        office_fee: 1800,
        total: 1800,
      },
    }),

    // 5. Normal — cancelled
    prisma.job.create({
      data: {
        account_id: ACCOUNT_ID,
        user_id: USER_ID,
        client_id: client2.id,
        status: 'cancelled',
        pickup: '55 Obafemi Awolowo Way, Ikeja',
        dropoff: '8 Trans Amadi, Port Harcourt',
        description: 'Books',
        office_fee: 1200,
        total: 1200,
      },
    }),

    // 6. Sublet — pending
    prisma.job.create({
      data: {
        account_id: ACCOUNT_ID,
        user_id: USER_ID,
        client_id: client2.id,
        status: 'pending',
        pickup: '22 Broad Street, Lagos Island',
        dropoff: '10 Ogui Road, Enugu',
        description: 'Documents',
        office_fee: 2000,
        sublet_name: 'GIG Logistics',
        sublet_amount: 3500,
        total: 5500,
      },
    }),

    // 7. Sublet — delivered
    prisma.job.create({
      data: {
        account_id: ACCOUNT_ID,
        user_id: USER_ID,
        client_id: client3.id,
        status: 'delivered',
        pickup: '1 Kano Street, Ebute Meta',
        dropoff: '45 Zaria Road, Kaduna',
        description: 'Machinery parts',
        office_fee: 3000,
        sublet_name: 'ABC Transport',
        sublet_amount: 8000,
        park_waybill: 500,
        total: 11500,
      },
    }),

    // 8. Sublet — picked_up
    prisma.job.create({
      data: {
        account_id: ACCOUNT_ID,
        user_id: USER_ID,
        client_id: client1.id,
        status: 'picked_up',
        pickup: '9 Creek Road, Apapa',
        dropoff: '17 Aggrey Road, Calabar',
        office_fee: 2500,
        sublet_name: 'Peace Mass Transit',
        sublet_amount: 5000,
        total: 7500,
      },
    }),

    // 9. Partner — delivered
    prisma.job.create({
      data: {
        account_id: ACCOUNT_ID,
        user_id: USER_ID,
        client_id: client1.id,
        rider_id: rider2.id,
        status: 'delivered',
        pickup: '3 Kingsway Road, Ikoyi',
        dropoff: '88 Aba Road, Port Harcourt',
        description: 'Electronics',
        office_fee: 2500,
        partner_id: partner1.id,
        partner_name_snapshot: partner1.name,
        partner_amount: 1000,
        total: 3500,
      },
    }),

    // 10. Partner — pending
    prisma.job.create({
      data: {
        account_id: ACCOUNT_ID,
        user_id: USER_ID,
        client_id: client2.id,
        status: 'pending',
        pickup: '12 Bode Thomas Street, Surulere',
        dropoff: '34 Sapele Road, Benin City',
        description: 'Cosmetics',
        office_fee: 1800,
        partner_id: partner2.id,
        partner_name_snapshot: partner2.name,
        partner_amount: 2200,
        total: 4000,
      },
    }),

    // 11. Partner — picked_up
    prisma.job.create({
      data: {
        account_id: ACCOUNT_ID,
        user_id: USER_ID,
        client_id: client3.id,
        rider_id: rider1.id,
        status: 'picked_up',
        pickup: '6 Idejo Street, Victoria Island',
        dropoff: '21 Enugu Road, Onitsha',
        description: 'Medical supplies',
        office_fee: 3500,
        partner_id: partner3.id,
        partner_name_snapshot: partner3.name,
        partner_amount: 1500,
        park_waybill: 300,
        total: 5300,
      },
    }),

    // 12. Normal — delivered
    prisma.job.create({
      data: {
        account_id: ACCOUNT_ID,
        user_id: USER_ID,
        client_id: client3.id,
        rider_id: rider2.id,
        status: 'delivered',
        pickup: '2 Ozumba Mbadiwe Avenue, VI',
        dropoff: '50 Stadium Road, Port Harcourt',
        description: 'Food items',
        office_fee: 2000,
        park_waybill: 400,
        total: 2400,
      },
    }),
  ]);

  const [job1, , , , , , , , job9, , , job12] = jobs;

  // Payments
  await Promise.all([
    prisma.payment.create({
      data: { job_id: job1.id, amount: 1700, mode: 'cash' },
    }),
    prisma.payment.create({
      data: {
        job_id: job9.id,
        amount: 2000,
        mode: 'transfer',
        bank_name: 'GTBank',
        reference: 'TRF20241116001',
      },
    }),
    prisma.payment.create({
      data: { job_id: job9.id, amount: 1500, mode: 'cash' },
    }),
    prisma.payment.create({
      data: {
        job_id: job12.id,
        amount: 2400,
        mode: 'transfer',
        bank_name: 'Access Bank',
        reference: 'TRF20241116002',
      },
    }),
  ]);

  // Expenses
  await Promise.all([
    prisma.expense.create({
      data: {
        account_id: ACCOUNT_ID,
        user_id: USER_ID,
        description: 'Fuel for bike 1',
        amount: 5000,
        mode: 'cash',
        owner: 'rider',
        rider_id: rider1.id,
        job_id: job1.id,
      },
    }),
    prisma.expense.create({
      data: {
        account_id: ACCOUNT_ID,
        user_id: USER_ID,
        description: 'Fuel for bike 2',
        amount: 4500,
        mode: 'cash',
        owner: 'rider',
        rider_id: rider2.id,
      },
    }),
    prisma.expense.create({
      data: {
        account_id: ACCOUNT_ID,
        user_id: USER_ID,
        description: 'Office internet subscription',
        amount: 15000,
        mode: 'transfer',
        bank_name: 'Access Bank',
        owner: 'office',
      },
    }),
    prisma.expense.create({
      data: {
        account_id: ACCOUNT_ID,
        user_id: USER_ID,
        description: 'Generator fuel',
        amount: 8000,
        mode: 'cash',
        owner: 'office',
      },
    }),
    prisma.expense.create({
      data: {
        account_id: ACCOUNT_ID,
        user_id: USER_ID,
        description: 'Packaging materials',
        amount: 3000,
        mode: 'cash',
        owner: 'client',
        client_id: client1.id,
      },
    }),
    prisma.expense.create({
      data: {
        account_id: ACCOUNT_ID,
        user_id: USER_ID,
        description: 'Custom crates for fragile items',
        amount: 6000,
        mode: 'transfer',
        bank_name: 'First Bank',
        owner: 'client',
        client_id: client3.id,
      },
    }),
  ]);

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
