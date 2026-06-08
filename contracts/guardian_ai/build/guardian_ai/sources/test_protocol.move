/// A minimal mock DeFi protocol used for testnet demos and integration testing.
/// Represents the code a real protocol team would add to their own contract
/// to integrate GuardianAI — two circuit breaker functions and admin overrides.
///
/// In production: this module lives in the protocol team's own package,
/// not in guardian_ai. It is here solely so the hackathon demo is self-contained.
module guardian_ai::test_protocol {
    use std::string::{Self, String};
    use sui::clock::Clock;
    use sui::event;
    use guardian_ai::cap::{Self, GuardianCap, AdminCap, GuardianConfig};
    use guardian_ai::action_log::{Self, ActionLog};

    // === Errors ===

    const EInvalidLtv: u64 = 0;

    // === Structs ===

    /// The core protocol state. Shared so the frontend and agent can both read it.
    public struct Protocol has key {
        id:           UID,
        name:         String,
        paused:       bool,
        ltv_ratio:    u64,   // basis points — 8000 = 80%
        pool_balance: u64,   // mock balance in MIST
        total_borrows: u64,
    }

    // === Events ===

    public struct ProtocolPaused has copy, drop {
        protocol_id: ID,
        risk_score:  u8,
        reason:      String,
    }

    public struct ProtocolUnpaused has copy, drop {
        protocol_id: ID,
    }

    public struct LtvTightened has copy, drop {
        protocol_id: ID,
        old_ltv:     u64,
        new_ltv:     u64,
        risk_score:  u8,
    }

    public struct PoolDrained has copy, drop {
        protocol_id:  ID,
        new_balance:  u64,
        pct_drained:  u64,
    }

    // === Initialisation ===

    /// Creates the protocol shared object with sensible defaults.
    public fun create(name: String, ctx: &mut TxContext): Protocol {
        Protocol {
            id:            object::new(ctx),
            name,
            paused:        false,
            ltv_ratio:     8000,
            pool_balance:  10_000_000_000_000, // 10M MIST
            total_borrows: 0,
        }
    }

    /// Makes the Protocol a shared object.
    public fun share(protocol: Protocol) {
        transfer::share_object(protocol);
    }

    /// Convenience entry: creates and shares the Protocol in one transaction.
    public entry fun create_and_share(name: String, ctx: &mut TxContext) {
        share(create(name, ctx));
    }

    // === Guardian Circuit Breakers ===
    // These two functions are the only entry points the agent can call.
    // Both require a &GuardianCap (type-enforced permission) and check
    // GuardianConfig (runtime-enforced enabled flag) before acting.

    /// Halts all protocol activity. Called when risk score >= 85.
    public fun pause_protocol(
        cap:        &GuardianCap,
        config:     &GuardianConfig,
        protocol:   &mut Protocol,
        log:        &mut ActionLog,
        clock:      &Clock,
        risk_score: u8,
        reason:     String,
    ) {
        cap::assert_active(cap, config);
        protocol.paused = true;

        event::emit(ProtocolPaused {
            protocol_id: object::id(protocol),
            risk_score,
            reason,
        });

        action_log::append(log, clock, risk_score, action_log::pause(), reason);
    }

    /// Reduces the LTV ratio to limit borrowing exposure. Called when risk score >= 70.
    /// new_ltv must be strictly less than the current ratio (can only tighten, not loosen).
    public fun tighten_ltv(
        cap:        &GuardianCap,
        config:     &GuardianConfig,
        protocol:   &mut Protocol,
        log:        &mut ActionLog,
        clock:      &Clock,
        new_ltv:    u64,
        risk_score: u8,
        reason:     String,
    ) {
        cap::assert_active(cap, config);
        assert!(new_ltv < protocol.ltv_ratio && new_ltv > 0, EInvalidLtv);

        let old_ltv = protocol.ltv_ratio;
        protocol.ltv_ratio = new_ltv;

        event::emit(LtvTightened {
            protocol_id: object::id(protocol),
            old_ltv,
            new_ltv,
            risk_score,
        });

        action_log::append(log, clock, risk_score, action_log::tighten_ltv(), reason);
    }

    // === Admin Override Functions ===
    // These require AdminCap — only the protocol team can call them.

    /// Resumes normal protocol operation after a guardian pause or manual review.
    public fun unpause_protocol(
        _admin:   &AdminCap,
        protocol: &mut Protocol,
        log:      &mut ActionLog,
        clock:    &Clock,
    ) {
        protocol.paused = false;

        event::emit(ProtocolUnpaused { protocol_id: object::id(protocol) });

        action_log::append(
            log,
            clock,
            0,
            action_log::unpause(),
            string::utf8(b"Protocol manually unpaused by admin"),
        );
    }

    /// Resets LTV to a new value. Only callable by the admin (e.g. after a guardian
    /// has tightened it and the market has normalised).
    public fun reset_ltv(
        _admin:   &AdminCap,
        protocol: &mut Protocol,
        new_ltv:  u64,
    ) {
        assert!(new_ltv > 0 && new_ltv <= 10_000, EInvalidLtv);
        protocol.ltv_ratio = new_ltv;
    }

    // === Simulation Helpers ===
    // Used by the demo script to create realistic attack patterns on testnet.
    // These would NOT exist in a production protocol contract.

    /// Simulates rapid pool drainage to trigger guardian risk signals.
    public fun simulate_pool_drain(
        _admin:      &AdminCap,
        protocol:    &mut Protocol,
        new_balance: u64,
    ) {
        let original = protocol.pool_balance;
        let drained = if (original > new_balance) { original - new_balance } else { 0 };
        let pct = if (original > 0) { (drained * 10_000) / original } else { 0 };

        protocol.pool_balance = new_balance;

        event::emit(PoolDrained {
            protocol_id: object::id(protocol),
            new_balance,
            pct_drained: pct,
        });
    }

    // === Accessors ===

    public fun is_paused(p: &Protocol): bool      { p.paused }
    public fun ltv_ratio(p: &Protocol): u64       { p.ltv_ratio }
    public fun pool_balance(p: &Protocol): u64    { p.pool_balance }
    public fun total_borrows(p: &Protocol): u64   { p.total_borrows }
    public fun name(p: &Protocol): &String        { &p.name }
}
