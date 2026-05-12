/**
 * One-shot script to set up our devnet USDC equivalent.
 *
 * This script:
 *   1. Creates a brand-new SPL token on devnet (6 decimals, like real USDC).
 *   2. Our US wallet is the "mint authority" — the only one who can create new tokens.
 *   3. Creates a token account for our US wallet to hold this token.
 *   4. Mints 1,000,000 tokens to the US wallet (plenty for testing).
 *   5. Prints the mint address to put in .env as SOLANA_USDC_MINT.
 *
 * Usage: npx ts-node scripts/setup-devnet-token.ts
 *
 * Run once. The mint address never changes. Re-running creates a SECOND token,
 * which you don't want. If you ever need more tokens, use the top-up script
 * (we'll add that separately if needed).
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo,
} from '@solana/spl-token';
import bs58 from 'bs58';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
    const rpcUrl = process.env.SOLANA_RPC_URL;
    const usSecret = process.env.SOLANA_US_WALLET_SECRET;

    if (!rpcUrl || !usSecret) {
        console.error('Missing SOLANA_RPC_URL or SOLANA_US_WALLET_SECRET in .env');
        process.exit(1);
    }

    const connection = new Connection(rpcUrl, 'confirmed');
    const usWallet = Keypair.fromSecretKey(bs58.decode(usSecret));

    console.log('Setting up devnet test token...\n');
    console.log(`  Wallet:  ${usWallet.publicKey.toBase58()}`);
    console.log(`  Network: ${rpcUrl}\n`);

    // Confirm wallet has SOL for fees
    const solBalance = await connection.getBalance(usWallet.publicKey);
    console.log(`  SOL balance: ${solBalance / 1e9} SOL`);
    if (solBalance < 1e8) {
        console.error('\n❌ Wallet needs at least ~0.1 SOL for setup. Airdrop more.');
        process.exit(1);
    }

    // 1. Create the token mint (6 decimals like real USDC)
    console.log('\nStep 1: Creating new SPL token mint (this may take 5-10 seconds)...');
    const mint = await createMint(
        connection,
        usWallet,            // payer
        usWallet.publicKey,  // mint authority (only we can mint new ones)
        usWallet.publicKey,  // freeze authority
        6,                   // decimals
    );
    console.log(`  ✓ Mint created: ${mint.toBase58()}`);

    // 2. Create the US wallet's associated token account for this mint
    console.log('\nStep 2: Creating token account for US wallet...');
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        usWallet,
        mint,
        usWallet.publicKey,
    );
    console.log(`  ✓ Token account: ${tokenAccount.address.toBase58()}`);

    // 3. Mint 1,000,000 tokens (= 1_000_000 * 10^6 = 1e12 base units)
    const amount = 1_000_000 * 1e6;
    console.log('\nStep 3: Minting 1,000,000 test USDC to US wallet...');
    const mintSig = await mintTo(
        connection,
        usWallet,
        mint,
        tokenAccount.address,
        usWallet,            // mint authority
        amount,
    );
    console.log(`  ✓ Mint tx signature: ${mintSig}`);

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('SETUP COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('Update your .env:\n');
    console.log(`SOLANA_USDC_MINT=${mint.toBase58()}\n`);

    console.log('Verify on Solana Explorer:');
    console.log(
        `  https://explorer.solana.com/address/${usWallet.publicKey.toBase58()}/tokens?cluster=devnet\n`,
    );
    console.log('You should see 1,000,000 of this token in your wallet.\n');
}

main().catch((err) => {
    console.error('\n❌ Setup failed:', err);
    process.exit(1);
});