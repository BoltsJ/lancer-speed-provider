Hooks.once("enhancedTerrainLayer.ready", (RuleProvider) => {
  class LancerRuleProvider extends RuleProvider {
    /**
     * TODO: Figure out what ignores difficult terrain
     * Bulwark Mods (Mech system & npc feature)
     * Kai Bioplating (Core bonus and npc feature)
     * Weathering (Npc trait, wallflower, Swallowtail ranger variant)
     */
    calculateCombinedCost(terrain, options) {
      const effects = getStatusIds(options.token.actor);
      const prone = effects.some((e) => e.endsWith("prone"));
      return Math.max(
        super.calculateCombinedCost(terrain, options),
        prone ? 2 : 1
      );
    }
  }

  enhancedTerrainLayer.registerModule(
    "lancer-speed-provider",
    LancerRuleProvider
  );
});

Hooks.once("dragRuler.ready", (SpeedProvider) => {
  class LancerSpeedProvider extends SpeedProvider {
    get colors() {
      return [
        {
          id: "standard",
          default: 0x1e88e5,
          name: "lancer-speed-provider.standard",
        },
        {
          id: "boost",
          default: 0xffc107,
          name: "lancer-speed-provider.boost",
        },
        {
          id: "over-boost",
          default: 0xd81b60,
          name: "lancer-speed-provider.over-boost",
        },
      ];
    }

    get defaultUnreachableColor() {
      return 0x000000;
    }

    /** @param token {Token} The token to check movement */
    getRanges(token) {
      const terrain_ruler = !!game.modules.get("terrain-ruler")?.active;
      const actor = token.actor;
      const effects = getStatusIds(actor);
      /**@type{number}*/
      let speed = actor.system.derived.speed;
      const stunned =
        effects.filter((e) => {
          return (
            e.endsWith("stunned") ||
            e.endsWith("immobilized") ||
            e.endsWith("shutdown") ||
            e.endsWith("downandout")
          );
        }).length > 0;
      // Cant move if stunned or immobilized
      if (stunned) return [{ range: -1, color: "standard" }];

      const prone = effects.some((e) => e.endsWith("prone"));
      /** @type {boolean} */
      const startedProne = game.combat?.combatants
        .find((c) => c.tokenId === token.id)
        ?.getFlag("lancer-speed-provider", "turn-status")
        ?.some((e) => e.endsWith("prone"));
      const slowed = prone || effects.some((e) => e.endsWith("slowed"));
      // Handle prone reduced move with terrain layer iff it is installed
      if (!terrain_ruler && prone) speed = Math.floor(speed / 2);

      let range = speed;
      const ranges = [];
      if (prone || !startedProne) {
        ranges.push({ range, color: "standard" });
        range += speed;
      }
      if (!slowed) {
        ranges.push({ range, color: "boost" });
        range += speed;
      }
      if (!slowed && canOvercharge(actor)) {
        ranges.push({ range, color: "over-boost" });
        range += speed;
      }

      return ranges;
    }
  }

  dragRuler.registerModule("lancer-speed-provider", LancerSpeedProvider);
});

Hooks.on("updateCombat", (combat, change) => {
  if (!("turn" in change) || !combat.current.tokenId) return;
  const token = game.canvas.tokens.get(combat.current.tokenId);
  if (!token?.isOwner) return;
  const combatant = combat.combatants.get(combat.current.combatantId);
  if (!combatant?.isOwner) return;
  const conditionIds = getStatusIds(token.actor);
  combatant.setFlag("lancer-speed-provider", "turn-status", conditionIds);
});

/**
 * @returns {boolean}
 */
function canOvercharge(actor) {
  if (actor.is_npc()) {
    const limitless = actor.itemTypes.npc_feature.some(
      (i) => i.name === "LIMITLESS"
    );
  }
  return actor.is_mech();
}

/**
 * @returns {Array<string>}
 */
function getStatusIds(actor) {
  return actor.effects
    .map((e) => e.getFlag("core", "statusId"))
    .filter((e) => !!e);
}
