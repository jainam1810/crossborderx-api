import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

/**
 * Loads, validates, and exposes Solana configuration from environment variables.
 *
 * Reads at startup:
 *   SOLANA_NETWORK            'devnet' | 'mainnet-beta' | 'testnet'
 *   SOLANA_RPC_URL            Override URL (optional; falls back to network default)
 *   SOLANA_USDC_MINT          Public key of the USDC (or test) token mint
 *   SOLANA_US_WALLET_PUBLIC   Public key of the US hot wallet
 *   SOLANA_US_WALLET_SECRET   Base58-encoded secret key of the US wallet
 *   SOLANA_UK_WALLET_PUBLIC   Public key of the UK hot wallet
 *   SOLANA_UK_WALLET_SECRET   Base58-encoded secret key of the UK wallet
 *
 * Crashes loudly at boot if any of these are missing or malformed.
 */
@Injectable()
export class SolanaConfigService implements OnModuleInit {
    private readonly logger = new Logger('SolanaConfig');

    private _network!: 'devnet' | 'mainnet-beta' | 'testnet';
    private _rpcUrl!: string;
    private _connection!: Connection;
    private _usdcMint!: PublicKey;
    private _usWallet!: Keypair;
    private _ukWallet!: Keypair;

    onModuleInit() {
        this.load();
    }

    private load() {
        const network = this.requireEnv('SOLANA_NETWORK');
        if (!['devnet', 'mainnet-beta', 'testnet'].includes(network)) {
            throw new Error(
                `SOLANA_NETWORK must be one of: devnet, mainnet-beta, testnet. Got: ${network}`,
            );
        }
        this._network = network as typeof this._network;

        // RPC URL: prefer explicit override, else use sensible default
        this._rpcUrl =
            process.env.SOLANA_RPC_URL ?? this.defaultRpcUrl(this._network);

        this._connection = new Connection(this._rpcUrl, 'confirmed');

        this._usdcMint = this.parsePublicKey(
            this.requireEnv('SOLANA_USDC_MINT'),
            'SOLANA_USDC_MINT',
        );

        this._usWallet = this.parseKeypair(
            this.requireEnv('SOLANA_US_WALLET_SECRET'),
            'SOLANA_US_WALLET_SECRET',
        );

        this._ukWallet = this.parseKeypair(
            this.requireEnv('SOLANA_UK_WALLET_SECRET'),
            'SOLANA_UK_WALLET_SECRET',
        );

        // Cross-check: public key in env should match the one derived from the secret
        this.assertWalletMatch(
            this._usWallet,
            this.requireEnv('SOLANA_US_WALLET_PUBLIC'),
            'US',
        );
        this.assertWalletMatch(
            this._ukWallet,
            this.requireEnv('SOLANA_UK_WALLET_PUBLIC'),
            'UK',
        );

        this.logger.log(`Network: ${this._network}`);
        this.logger.log(`RPC:     ${this._rpcUrl}`);
        this.logger.log(`USDC Mint: ${this._usdcMint.toBase58()}`);
        this.logger.log(`US wallet: ${this._usWallet.publicKey.toBase58()}`);
        this.logger.log(`UK wallet: ${this._ukWallet.publicKey.toBase58()}`);

        if (this._network === 'mainnet-beta') {
            this.logger.warn(
                '⚠️  Running against MAINNET. Real funds at stake. Make sure this is intentional.',
            );
        }
    }

    // ─── Public accessors ───

    get network() {
        return this._network;
    }

    get rpcUrl() {
        return this._rpcUrl;
    }

    get connection() {
        return this._connection;
    }

    get usdcMint() {
        return this._usdcMint;
    }

    get usWallet() {
        return this._usWallet;
    }

    get ukWallet() {
        return this._ukWallet;
    }

    // Convenient for explorer links
    get explorerBaseUrl() {
        return this._network === 'mainnet-beta'
            ? 'https://explorer.solana.com'
            : `https://explorer.solana.com/?cluster=${this._network}`;
    }

    explorerTxUrl(signature: string) {
        return this._network === 'mainnet-beta'
            ? `https://explorer.solana.com/tx/${signature}`
            : `https://explorer.solana.com/tx/${signature}?cluster=${this._network}`;
    }

    // ─── Private helpers ───

    private requireEnv(key: string): string {
        const v = process.env[key];
        if (!v || v.trim() === '') {
            throw new Error(`Required env var ${key} is missing or empty.`);
        }
        return v.trim();
    }

    private defaultRpcUrl(network: typeof this._network): string {
        switch (network) {
            case 'devnet':
                return 'https://api.devnet.solana.com';
            case 'testnet':
                return 'https://api.testnet.solana.com';
            case 'mainnet-beta':
                // Public mainnet RPC is heavily rate-limited.
                // For real volume, set SOLANA_RPC_URL to a paid provider (Helius, QuickNode, Triton).
                return 'https://api.mainnet-beta.solana.com';
        }
    }

    private parsePublicKey(raw: string, label: string): PublicKey {
        try {
            return new PublicKey(raw);
        } catch {
            throw new Error(`${label} is not a valid Solana public key: ${raw}`);
        }
    }

    private parseKeypair(rawSecret: string, label: string): Keypair {
        try {
            const decoded = bs58.decode(rawSecret);
            if (decoded.length !== 64) {
                throw new Error(
                    `expected 64 bytes after base58 decode, got ${decoded.length}`,
                );
            }
            return Keypair.fromSecretKey(decoded);
        } catch (err: any) {
            throw new Error(`${label} is not a valid base58 keypair secret: ${err.message}`);
        }
    }

    private assertWalletMatch(
        keypair: Keypair,
        expectedPublic: string,
        which: 'US' | 'UK',
    ) {
        const derived = keypair.publicKey.toBase58();
        if (derived !== expectedPublic) {
            throw new Error(
                `${which} wallet mismatch: secret key derives ${derived}, but SOLANA_${which}_WALLET_PUBLIC says ${expectedPublic}. Update one or the other.`,
            );
        }
    }
}