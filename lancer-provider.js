Hooks.once("dragRuler.ready", (SpeedProvider) => {
  class LancerSpeedProvider extends SpeedProvider {
    get colors() {
      return [
        {
          id: "standard",
          default: 0x4499f5,
          name: "lancer-speed-provider.standard",
        },
        {
          id: "boost",
          default: 0xf5d472,
          name: "lancer-speed-provider.boost",
        },
        {
          id: "over-boost",
          default: 0xff4b01,
          name: "lancer-speed-provider.over-boost",
        },
      ];
    }

    get defaultUnreachableColor() {
      return 0x000000;
    }

    /**
     * @param token {Token}
     */
    getRanges(token) {
      // Cant move if stunned or immobilized
      const actor = token.actor;
      const effects = getStatusIds(actor);
      const stunned =
        effects.filter(
          (e) =>
            e?.endsWith("stunned") ||
            e?.endsWith("immobilized") ||
            e?.endsWith("shutdown") ||
            e?.endsWith("downandout")
        ).length > 0;
      if (stunned) return [{ range: 0, color: "standard" }];

      // Can't boost if stunned
      /**@type{number}*/
      const speed = actor.data.data.derived.speed;
      const slowed = effects.filter((e) => e?.endsWith("slow")).length > 0;

      const ranges = [{ range: speed, color: "standard" }];
      if (!slowed && !actor.is_pilot())
        ranges.push({ range: speed * 2, color: "boost" });
      if (!slowed && canOvercharge(actor))
        ranges.push({ range: speed * 3, color: "over-boost" });

      return ranges;
    }

    /**
     * TODO: Figure out what ignores difficult terrain
    getCostForStep(token, area, options={}) {
      return super.getCostForStep(token, area, options);
    }
    */
  }

  dragRuler.registerModule("lancer-speed-provider", LancerSpeedProvider);
});

/**
 * @returns {boolean}
 */
function canOvercharge(actor) {
  if (actor.is_npc()) {
    const limitless = actor.itemTypes.npc_feature.find(
      (i) => i.name === "LIMITLESS"
    );
    return !!limitless;
  }
  return actor.is_mech();
}

/**
 * @returns {Array<string>}
 */
function getStatusIds(actor) {
  return actor.effects.map((e) => e.getFlag("core", "statusId"));
}
