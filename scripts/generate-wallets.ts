/**
 * One-shot script to generate two Solana keypairs (US + UK hot wallets).
 *
 * Outputs:
 *   - keypairs.json: full keypair data, NEVER commit to git
 *   - prints the .env-friendly strings to copy into your .env file
 *
 * Usage:
 *   npx ts-node scripts/generate-wallets.ts
 *
 * After running:
 *   1. Copy the printed env vars into your .env
 *   2. The keypairs.json file is your backup — keep it safe, never commit it
 */

import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import * as fs from 'fs';
import * as path from 'path';

function generateOne(label: string) {
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toBase58();
    const secretKeyBase58 = bs58.encode(keypair.secretKey);
    return { label, publicKey, secretKeyBase58 };
}

console.log('Generating two Solana keypairs for devnet...\n');

const us = generateOne('US_HOT_WALLET');
const uk = generateOne('UK_HOT_WALLET');

// Write a backup file (gitignored) with both keypairs
const backupPath = path.join(__dirname, '..', 'keypairs.json');
fs.writeFileSync(
    backupPath,
    JSON.stringify(
        {
            generatedAt: new Date().toISOString(),
            wallets: [us, uk],
            warning:
                'NEVER commit this file. NEVER share the secret keys. Devnet keys are worthless, but this same format would be catastrophic on mainnet.',
        },
        null,
        2,
    ),
);

// Print the friendly .env-style output
console.log('═══════════════════════════════════════════════════════════════');
console.log('GENERATED WALLETS');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log(`US hot wallet:`);
console.log(`  Public:  ${us.publicKey}`);
console.log(`  Secret:  ${us.secretKeyBase58.substring(0, 12)}... (${us.secretKeyBase58.length} chars)\n`);

console.log(`UK hot wallet:`);
console.log(`  Public:  ${uk.publicKey}`);
console.log(`  Secret:  ${uk.secretKeyBase58.substring(0, 12)}... (${uk.secretKeyBase58.length} chars)\n`);

console.log('═══════════════════════════════════════════════════════════════');
console.log('ADD TO .env  (full secret keys are below)');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log(`SOLANA_NETWORK=devnet`);
console.log(`SOLANA_RPC_URL=https://api.devnet.solana.com`);
console.log(`SOLANA_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`);
console.log(`SOLANA_US_WALLET_PUBLIC=${us.publicKey}`);
console.log(`SOLANA_US_WALLET_SECRET=${us.secretKeyBase58}`);
console.log(`SOLANA_UK_WALLET_PUBLIC=${uk.publicKey}`);
console.log(`SOLANA_UK_WALLET_SECRET=${uk.secretKeyBase58}\n`);

console.log('═══════════════════════════════════════════════════════════════');
console.log(`Backup saved to: ${backupPath}`);
console.log('IMPORTANT: confirm this file is in .gitignore before any git commit.');
console.log('═══════════════════════════════════════════════════════════════');