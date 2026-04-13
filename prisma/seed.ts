import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ledgerAccounts = [
    // ASSET accounts (money you hold)
    { code: 'ASSET:USD:STRIPE', name: 'USD held in Stripe', type: 'ASSET', currency: 'USD' },
    { code: 'ASSET:USD:BANK', name: 'USD in business bank account', type: 'ASSET', currency: 'USD' },
    { code: 'ASSET:USDC:HOT_WALLET_US', name: 'USDC in US Solana wallet', type: 'ASSET', currency: 'USDC' },
    { code: 'ASSET:USDC:HOT_WALLET_UK', name: 'USDC in UK Solana wallet', type: 'ASSET', currency: 'USDC' },
    { code: 'ASSET:GBP:CLEARBANK', name: 'GBP held at ClearBank', type: 'ASSET', currency: 'GBP' },

    // LIABILITY accounts (money you owe)
    { code: 'LIABILITY:USD:USER_FUNDS', name: 'USD received from users, not yet settled', type: 'LIABILITY', currency: 'USD' },
    { code: 'LIABILITY:GBP:USER_FUNDS', name: 'GBP owed to recipients', type: 'LIABILITY', currency: 'GBP' },

    // REVENUE accounts (money you earn)
    { code: 'REVENUE:FEES', name: 'Flat fees collected', type: 'REVENUE', currency: 'USD' },
    { code: 'REVENUE:SPREAD', name: 'FX spread revenue', type: 'REVENUE', currency: 'USD' },

    // EXPENSE accounts (money you spend)
    { code: 'EXPENSE:GAS_FEES', name: 'Blockchain transaction fees', type: 'EXPENSE', currency: 'USDC' },
    { code: 'EXPENSE:ONRAMP_FEES', name: 'Circle/Stripe processing fees', type: 'EXPENSE', currency: 'USD' },
    { code: 'EXPENSE:OFFRAMP_FEES', name: 'ClearBank/OTC fees', type: 'EXPENSE', currency: 'GBP' },
    { code: 'EXPENSE:KYC_FEES', name: 'Sumsub per-check costs', type: 'EXPENSE', currency: 'USD' },
];

async function main() {
    console.log('Seeding ledger accounts...');

    for (const account of ledgerAccounts) {
        await prisma.ledgerAccount.upsert({
            where: { code: account.code },
            update: {},
            create: account,
        });
        console.log(`  ✓ ${account.code}`);
    }

    console.log('Done! All ledger accounts seeded.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());