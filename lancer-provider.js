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
      const actor = token.actor;
      const effects = Array.from(actor.statuses);
      /**@type{number}*/
      let speed = actor.system.speed + enkidu_all_fours(actor);
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
      const slowed = prone || effects.some((e) => e.endsWith("slow"));
      // Handle prone reduced move with terrain layer iff it is installed
      if (prone) speed = Math.floor(speed / 2);

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
  const conditionIds = Array.from(token.actor.statuses);
  combatant.setFlag("lancer-speed-provider", "turn-status", conditionIds);
});

/**
 * @returns {boolean}
 */
function canOvercharge(actor) {
  if (actor.is_npc()) {
    return actor.itemTypes.npc_feature.some((i) => i.name === "LIMITLESS");
  }
  return actor.is_mech();
}

function enkidu_all_fours(actor) {
  return actor.items.some((i) => i.system.lid === "mf_tokugawa_alt_enkidu") &&
    Array.from(actor.statuses).some((e) => e.endsWith("dangerzone"))
    ? 3
    : 0;
}
