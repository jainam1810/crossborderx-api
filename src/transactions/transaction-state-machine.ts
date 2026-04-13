import { BadRequestException } from '@nestjs/common';

/**
 * Transaction State Machine
 * 
 * This defines the ONLY valid paths a transaction can take.
 * Think of it like a one-way road — you can only go forward,
 * or go to FAILED. You can never go backwards.
 * 
 * Happy path:
 *   INITIATED → FIAT_RECEIVED → STABLECOIN_ACQUIRED → SETTLED_ON_CHAIN
 *   → FIAT_CONVERTED → PAYOUT_INITIATED → COMPLETED
 * 
 * Any step can fail:
 *   (any status) → FAILED → REFUNDED
 */

// Map of: current status → list of statuses it's allowed to move to
const VALID_TRANSITIONS: Record<string, string[]> = {
    INITIATED: ['FIAT_RECEIVED', 'FAILED'],
    FIAT_RECEIVED: ['STABLECOIN_ACQUIRED', 'FAILED'],
    STABLECOIN_ACQUIRED: ['SETTLED_ON_CHAIN', 'FAILED'],
    SETTLED_ON_CHAIN: ['FIAT_CONVERTED', 'FAILED'],
    FIAT_CONVERTED: ['PAYOUT_INITIATED', 'FAILED'],
    PAYOUT_INITIATED: ['COMPLETED', 'FAILED'],
    FAILED: ['REFUNDED'],
    COMPLETED: [],   // terminal — nothing after this
    REFUNDED: [],   // terminal — nothing after this
};

/**
 * Check if a transition is valid. Throws an error if not.
 * 
 * Example:
 *   assertTransition('INITIATED', 'FIAT_RECEIVED')      → OK
 *   assertTransition('COMPLETED', 'FIAT_RECEIVED')       → ERROR (can't go backwards)
 *   assertTransition('INITIATED', 'COMPLETED')            → ERROR (can't skip steps)
 */
export function assertTransition(from: string, to: string): void {
    const allowed = VALID_TRANSITIONS[from];

    if (!allowed) {
        throw new BadRequestException(`Unknown transaction status: ${from}`);
    }

    if (!allowed.includes(to)) {
        throw new BadRequestException(
            `Invalid transition: ${from} → ${to}. Allowed: [${allowed.join(', ')}]`
        );
    }
}

/**
 * Check if a status is terminal (transaction is done, no more changes).
 */
export function isTerminal(status: string): boolean {
    return status === 'COMPLETED' || status === 'REFUNDED';
}

/**
 * Get all valid next statuses from the current one.
 */
export function getNextStatuses(current: string): string[] {
    return VALID_TRANSITIONS[current] || [];
}