# Enemy Definitions

Each enemy has its own file and inherits from `EnemyDefinitionBase`.

Edit these files to tune per-enemy stats and content:

- `tankEnemy.ts`
- `strikerEnemy.ts`
- `bruteEnemy.ts`

Each file defines:

- `name`
- `maxHp`
- `movementSpeed`
- `shotDamage`
- `fireRateSeconds`
- `behavior`
- `attackSound`
- `positionalLoopSound`
- and related combat values.
