/// Defines the capability objects that grant the GuardianAI agent its narrow,
/// type-enforced permissions. The agent holds GuardianCap; the protocol team
/// holds AdminCap and can disable the guardian at any time via GuardianConfig.
module guardian_ai::cap {
    use sui::event;

    // === Errors ===

    const EGuardianDisabled: u64 = 0;

    // === Structs ===

    /// Owned by the GuardianAI agent wallet. Passed as a reference to every
    /// circuit breaker function — Move's type system ensures only the holder
    /// of this object can invoke those functions.
    public struct GuardianCap has key, store {
        id: UID,
    }

    /// Owned by the protocol team. Used to enable, disable, or hand off
    /// guardian configuration without touching the agent's cap.
    public struct AdminCap has key, store {
        id: UID,
        guardian_cap_id: ID,
    }

    /// Shared object. Tracks live guardian state for a specific protocol.
    /// All circuit breaker functions read this to enforce the enabled flag.
    public struct GuardianConfig has key {
        id: UID,
        guardian_cap_id: ID,
        agent_address: address,
        enabled: bool,
    }

    // === Events ===

    public struct GuardianInitialized has copy, drop {
        guardian_cap_id: ID,
        agent_address: address,
    }

    public struct GuardianStatusChanged has copy, drop {
        guardian_cap_id: ID,
        enabled: bool,
    }

    // === Public Functions ===

    /// Called once by the protocol team to initialise the guardian setup.
    /// Transfers GuardianCap to the agent, keeps AdminCap for the caller,
    /// and shares GuardianConfig so anyone can verify state on-chain.
    #[allow(lint(self_transfer))]
    public fun initialize(agent_address: address, ctx: &mut TxContext) {
        let guardian_cap = GuardianCap { id: object::new(ctx) };
        let guardian_cap_id = object::id(&guardian_cap);

        let admin_cap = AdminCap {
            id: object::new(ctx),
            guardian_cap_id,
        };

        let config = GuardianConfig {
            id: object::new(ctx),
            guardian_cap_id,
            agent_address,
            enabled: true,
        };

        event::emit(GuardianInitialized { guardian_cap_id, agent_address });

        transfer::public_transfer(guardian_cap, agent_address);
        transfer::public_transfer(admin_cap, ctx.sender());
        transfer::share_object(config);
    }

    /// Instantly disables the guardian. The agent can no longer call any
    /// circuit breaker that checks assert_active. Emits an on-chain event.
    public fun disable(_admin: &AdminCap, config: &mut GuardianConfig) {
        config.enabled = false;
        event::emit(GuardianStatusChanged {
            guardian_cap_id: config.guardian_cap_id,
            enabled: false,
        });
    }

    /// Re-enables the guardian after a manual pause or review.
    public fun enable(_admin: &AdminCap, config: &mut GuardianConfig) {
        config.enabled = true;
        event::emit(GuardianStatusChanged {
            guardian_cap_id: config.guardian_cap_id,
            enabled: true,
        });
    }

    /// Called at the top of every circuit breaker function. Aborts if the
    /// admin has disabled the guardian, ensuring instant human override.
    public fun assert_active(_cap: &GuardianCap, config: &GuardianConfig) {
        assert!(config.enabled, EGuardianDisabled);
    }

    // === Accessors ===

    public fun is_enabled(config: &GuardianConfig): bool { config.enabled }
    public fun agent_address(config: &GuardianConfig): address { config.agent_address }
    public fun guardian_cap_id(config: &GuardianConfig): ID { config.guardian_cap_id }
    public fun admin_guardian_cap_id(admin: &AdminCap): ID { admin.guardian_cap_id }
}
