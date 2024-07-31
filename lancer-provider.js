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
      let speed = tokenSpeed(token);
      const stunned = isStunned(token);
      // Cant move if stunned or immobilized
      if (stunned) return [{ range: -1, color: "standard" }];

      const prone = effects.some((e) => e.endsWith("prone"));
      /** @type {boolean} */
      const startedProne = token.combatant
        ?.getFlag("lancer-speed-provider", "turn-status")
        ?.some((e) => e.endsWith("prone"));
      const slowed = prone || effects.some((e) => e.endsWith("slow"));

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

Hooks.once("init", () => {
  if (!game.modules.get("elevationruler")?.active) return;
  if (game.modules.get("drag-ruler")?.active) {
    Hooks.once("ready", () => {
      Dialog.prompt({
        title: "WARNING",
        content:
          "WARNING: Drag Ruler and Elevation Ruler both detected as active. These modules conflict. Please disable one.",
      })
        .catch(() => {})
        .then(() => new ModuleManagement().render(true));
    });
  }

  const isV12 = game.release.generation >= 12;
  if (!isV12) Hooks.on("renderSettingsConfig", renderSettingsConfig);

  game.settings.register("lancer-speed-provider", "color-standard", {
    name: "lancer-speed-provider.settings.color-standard.label",
    scope: "client",
    type: isV12
      ? new foundry.data.fields.ColorField({ required: true, blank: false })
      : String,
    default: "#1e88e5",
    config: true,
    onChange: (val) =>
      (CONFIG.elevationruler.SPEED.CATEGORIES.find(
        (c) => c.name === "lancer-speed-provider.standard",
      ).color = Color.from(val)),
  });
  game.settings.register("lancer-speed-provider", "color-boost", {
    name: "lancer-speed-provider.settings.color-boost.label",
    scope: "client",
    type: isV12
      ? new foundry.data.fields.ColorField({ required: true, blank: false })
      : String,
    default: "#ffc107",
    config: true,
    onChange: (val) =>
      (CONFIG.elevationruler.SPEED.CATEGORIES.find(
        (c) => c.name === "lancer-speed-provider.boost",
      ).color = Color.from(val)),
  });
  game.settings.register("lancer-speed-provider", "color-over-boost", {
    name: "lancer-speed-provider.settings.color-over-boost.label",
    scope: "client",
    type: isV12
      ? new foundry.data.fields.ColorField({ required: true, blank: false })
      : String,
    default: "#d81b60",
    config: true,
    onChange: (val) =>
      (CONFIG.elevationruler.SPEED.CATEGORIES.find(
        (c) => c.name === "lancer-speed-provider.over-boost",
      ).color = Color.from(val)),
  });

  CONFIG.elevationruler.SPEED.ATTRIBUTES.WALK = "actor.system.speed";
  CONFIG.elevationruler.SPEED.CATEGORIES = [
    {
      name: "lancer-speed-provider.standard",
      color: Color.from(
        game.settings.get("lancer-speed-provider", "color-standard"),
      ),
      multiplier: 1,
    },
    {
      name: "lancer-speed-provider.boost",
      color: Color.from(
        game.settings.get("lancer-speed-provider", "color-boost"),
      ),
      multiplier: 2,
    },
    {
      name: "lancer-speed-provider.over-boost",
      color: Color.from(
        game.settings.get("lancer-speed-provider", "color-over-boost"),
      ),
      multiplier: 3,
    },
    {
      name: "Unreachable",
      color: Color.from(0),
      multiplier: Infinity,
    },
  ];
  CONFIG.elevationruler.SPEED.tokenSpeed = tokenSpeed;
  CONFIG.elevationruler.SPEED.maximumCategoryDistance = maximumCategoryDistance;
});

Hooks.once("lancer.registerFlows", (steps, flows) => {
  steps.set("addCorePowerSE", async ({ actor }) => {
    if (actor.statuses.has("core_power_active")) return true;
    const ae = getDocumentClass("ActiveEffect");
    await ae.create(
      {
        name: game.i18n.localize("lancer-speed-provider.statuses.core_power"),
        statuses: ["core_power_active"],
        icon: "systems/lancer/assets/icons/white/corepower.svg",
        "flags.lancer-speed-provider.status": true,
      },
      { parent: actor },
    );
    return true;
  });
  flows
    .get("CoreActiveFlow")
    ?.insertStepAfter("consumeCorePower", "addCorePowerSE");
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

Hooks.on("preDeleteCombatant", (combatant) => {
  combatant.actor?.effects
    .filter((e) => e.getFlag("lancer-speed-provider", "status"))
    .forEach((e) => e.delete());
});

Hooks.on("preDeleteCombat", (combat) => {
  combat.combatants.forEach((c) =>
    c.actor?.effects
      .filter((e) => e.getFlag("lancer-speed-provider", "status"))
      .forEach((e) => e.delete()),
  );
});

function tokenSpeed(token) {
  const actor = token.actor;
  let speed = actor.system.speed;
  speed += enkidu_all_fours(actor);
  speed += lycan_go_loud(actor);
  if (token.actor.statuses.has("prone")) speed = Math.floor(speed / 2);
  return speed;
}

function maximumCategoryDistance(token, speedCategory, tokenSpeed) {
  if (speedCategory.name === "Unreachable") return Infinity;
  if (
    isStunned(token) ||
    (speedCategory.name === "lancer-speed-provider.over-boost" &&
      !canOvercharge(token.actor)) ||
    ([
      "lancer-speed-provider.boost",
      "lancer-speed-provider.over-boost",
    ].includes(speedCategory.name) &&
      slowed(token.actor))
  )
    return 0;

  tokenSpeed ??= CONFIG.elevationruler.SPEED.tokenSpeed(token);
  const startedProne = token.combatant
    ?.getFlag("lancer-speed-provider", "turn-status")
    ?.includes("prone");
  const prone = token.actor.statuses.has("prone");
  const firstMove = prone || !startedProne;
  const multiplier = speedCategory.multiplier - (firstMove ? 0 : 1);
  return tokenSpeed * multiplier;
}

/**
 * @returns {boolean}
 */
function canOvercharge(actor) {
  if (actor.is_npc()) {
    return actor.itemTypes.npc_feature.some((i) => i.name === "LIMITLESS");
  }
  return actor.is_mech();
}

function slowed(actor) {
  return !actor.statuses.isDisjointFrom(new Set(["slow", "prone"]));
}

function enkidu_all_fours(actor) {
  return actor.items.some((i) => i.system.lid === "mf_tokugawa_alt_enkidu") &&
    actor.statuses.has("dangerzone")
    ? 3
    : 0;
}

function lycan_go_loud(actor) {
  return actor.items.some((i) => i.system.lid === "mf_lycan") &&
    actor.statuses.has("core_power_active")
    ? 3
    : 0;
}

function isStunned(token) {
  return !token.actor.statuses.isDisjointFrom(
    new Set(["stunned", "immobilized", "shutdown", "downandout"]),
  );
}

function renderSettingsConfig(_app, el) {
  let standard = game.settings.get("lancer-speed-provider", "color-standard");
  let boost = game.settings.get("lancer-speed-provider", "color-boost");
  let ovboost = game.settings.get("lancer-speed-provider", "color-over-boost");

  el.find('[name="lancer-speed-provider.color-standard"]')
    .parent()
    .append(
      `<input type="color" value="${standard}" data-edit="lancer-speed-provider.color-standard">`,
    );
  el.find('[name="lancer-speed-provider.color-boost"]')
    .parent()
    .append(
      `<input type="color" value="${boost}" data-edit="lancer-speed-provider.color-boost">`,
    );
  el.find('[name="lancer-speed-provider.color-over-boost"]')
    .parent()
    .append(
      `<input type="color" value="${ovboost}" data-edit="lancer-speed-provider.color-over-boost">`,
    );
}
