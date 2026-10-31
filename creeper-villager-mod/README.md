# Creeper Trader (Fabric mod)

A creeper dressed as a villager, with a robe, a big villager nose and a straw hat.

- **Right-click it** to open the trade screen and buy TNT:
  - 1 emerald → 1 TNT
  - 5 emeralds → 8 TNT
  - 4 gunpowder + 4 sand → 1 TNT
- **Hit it** and the fuse lights: it stops trading, chases you, swells and flashes white like a regular creeper, then explodes (radius 3).

Get one from the **Creeper Trader Spawn Egg** in the Spawn Eggs creative tab, or with:

```
/summon creeper_trader:creeper_trader
```

## Requirements

- Minecraft **26.3** (Java Edition)
- Fabric Loader **0.20.1+** and **Fabric API**
- Java **25**

## Build

```bash
./gradlew build
```

The mod jar ends up in `build/libs/creeper_trader-1.0.0.jar`. Copy it, together with Fabric API, into your `.minecraft/mods` folder.

## Development

| Command | What it does |
| --- | --- |
| `./gradlew test` | JUnit tests for the trade definitions |
| `./gradlew runGameTest` | Boots a headless server and runs in-game tests (TNT offers; ignites and explodes when a player hits it) |
| `./gradlew runClient` | Launches the game with the mod |
| `python3 tools/gen_textures.py` | Regenerates the textures (requires Pillow) |

## Code layout

- `entity/CreeperTraderEntity` extends the vanilla `AbstractVillager` (the merchant base class), so it gets the trade screen for free.
- `entity/TraderMood` uses the State pattern (`Peaceful` → `Fuse`) for the behavior switch when a player hits it.
- `trade/TradeProvider` + `SimpleTrade` + `TntTrades`: Strategy + Factory for the offers.
- `registry/ModEntities`, `registry/ModItems`: registration.
- `client/CreeperTraderModel`: the creeper model plus a robe, nose and hat; `CreeperTraderRenderer` adds the creeper swell and flash.
