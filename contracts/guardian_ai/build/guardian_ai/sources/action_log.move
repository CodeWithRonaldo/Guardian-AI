/// On-chain audit trail for every action the GuardianAI agent takes.
/// Stored as a shared object so anyone — protocol team, users, auditors —
/// can read the full history without any trusted intermediary.
module guardian_ai::action_log {
    use std::string::String;
    use sui::clock::Clock;
    use sui::event;

    // === Action Codes ===
    // Stored as u8 to keep log entries gas-efficient.

    const ACTION_LOG_ONLY:    u8 = 0;
    const ACTION_NOTIFY:      u8 = 1;
    const ACTION_TIGHTEN_LTV: u8 = 2;
    const ACTION_PAUSE:       u8 = 3;
    const ACTION_UNPAUSE:     u8 = 4;

    // === Structs ===

    /// A single log entry. Compact by design — the off-chain Walrus blob
    /// holds the full context (raw signal values, Pyth data, etc.).
    public struct LogEntry has store, copy, drop {
        timestamp_ms: u64,
        risk_score:   u8,
        action:       u8,
        reason:       String,
    }

    /// Shared object. Append-only log of every guardian action on a protocol.
    public struct ActionLog has key {
        id:      UID,
        entries: vector<LogEntry>,
    }

    // === Events ===

    public struct EntryAdded has copy, drop {
        timestamp_ms: u64,
        risk_score:   u8,
        action:       u8,
        reason:       String,
    }

    // === Public Functions ===

    /// Creates a new ActionLog. Call share() immediately after.
    public fun create(ctx: &mut TxContext): ActionLog {
        ActionLog {
            id:      object::new(ctx),
            entries: vector[],
        }
    }

    /// Convenience entry: creates and shares the ActionLog in one transaction.
    public entry fun create_and_share(ctx: &mut TxContext) {
        share(create(ctx));
    }

    /// Makes the ActionLog a shared object so anyone can read it.
    public fun share(log: ActionLog) {
        transfer::share_object(log);
    }

    /// Appends an entry and emits an event. Called by circuit breaker
    /// functions — never called directly by external code.
    public fun append(
        log:        &mut ActionLog,
        clock:      &Clock,
        risk_score: u8,
        action:     u8,
        reason:     String,
    ) {
        let entry = LogEntry {
            timestamp_ms: clock.timestamp_ms(),
            risk_score,
            action,
            reason,
        };

        event::emit(EntryAdded {
            timestamp_ms: entry.timestamp_ms,
            risk_score,
            action,
            reason,
        });

        log.entries.push_back(entry);
    }

    // === Action Code Constants ===

    public fun log_only():    u8 { ACTION_LOG_ONLY }
    public fun notify():      u8 { ACTION_NOTIFY }
    public fun tighten_ltv(): u8 { ACTION_TIGHTEN_LTV }
    public fun pause():       u8 { ACTION_PAUSE }
    public fun unpause():     u8 { ACTION_UNPAUSE }

    // === ActionLog Accessors ===

    public fun entries(log: &ActionLog): &vector<LogEntry> { &log.entries }
    public fun entry_count(log: &ActionLog): u64 { log.entries.length() }

    // === LogEntry Accessors ===

    public fun entry_timestamp(e: &LogEntry): u64    { e.timestamp_ms }
    public fun entry_risk_score(e: &LogEntry): u8    { e.risk_score }
    public fun entry_action(e: &LogEntry): u8         { e.action }
    public fun entry_reason(e: &LogEntry): &String   { &e.reason }
}
