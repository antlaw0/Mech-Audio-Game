# Inventory & Cargo System Implementation Guide

For the first-person audio mech game

This implementation plan is structured specifically for:

* incremental implementation
* Copilot-friendly execution
* minimal refactors later
* accessibility-first UI flow
* future expansion for fabrication/shops

After each incramental implementation step, give me a list of how to test the implementation worked before moving on to the next step.

The goal is:

> Build the inventory/cargo foundation now without prematurely implementing advanced gameplay systems.

---

# High-Level System Architecture

The inventory system consists of:

| System              | Responsibility               |
| ------------------- | ---------------------------- |
| Item Definitions    | Static item templates        |
| Inventory Manager   | Player inventory logic       |
| Weight System       | Calculates mech/cargo weight |
| Item Instances      | Runtime stack quantities     |
| Loot Tables         | Randomized item generation   |
| World Pickups       | Loose spawned items          |
| Loot Containers     | Multi-item interactables     |
| Inventory UI        | Tabs/cards/actions           |
| Persistence Manager | Chunk-based cleanup          |
| Pickup System       | Auto/manual collection       |

---

# Core Design Rules

## Weight Philosophy

```text id="6nmtl8"
Total Mech Weight =
Installed Part Weight +
Cargo Weight
```

Cargo weight includes:

* supplies
* resources
* spare parts
* ammo resources
* rockets/missiles
* repair kits
* etc.

---

# Inventory Categories

## Supplies

Items with active use behavior.

Examples:

* Ammo Resource
* Rockets
* Missiles
* Grenades
* Repair Kits
* Coolant
* Energy Cells

Actions:

* Use
* Drop

---

## Resources

Raw materials only used for:

* fabrication
* trading
* crafting

Examples:

* Scrap Metal
* Electronics
* Composite Plating
* Reactor Material

Actions:

* Drop

---

## Parts

Spare equipment/components.

Examples:

* Weapons
* Reactors
* Legs
* Computers

Actions:

* Equip
* Drop

---

# IMPORTANT IMPLEMENTATION RULE

## NEVER store executable functions inside item data.

BAD:

```js
useFunction: () => {}
```

GOOD:

```js
useActionId: "restore_ep"
```

Gameplay systems resolve the action centrally.

---

# Recommended Folder Structure

```text id="r1m5jv"
src/
├── data/
│   ├── items/
│   ├── lootTables/
│   └── containers/
│
├── systems/
│   ├── inventory/
│   ├── loot/
│   ├── persistence/
│   └── weight/
│
├── ui/
│   ├── inventory/
│   ├── cards/
│   └── components/
│
├── entities/
│   ├── pickups/
│   └── containers/
│
└── managers/
    ├── InventoryManager
    ├── LootManager
    ├── PersistenceManager
    └── ItemDatabase
```

---

# PHASE 1

# Item Definitions

---

# Goal

Create reusable static item templates.

---

# Recommended Item Definition Schema

```ts
export interface ItemDefinition {
    id: string;
    name: string;
    description: string;

    category: "supplies" | "resources" | "parts";

    rarity: number;

    weightPerUnit: number;

    value: number;

    maxStackSize: number;

    iconId?: string;

    audioCueId?: string;

    flags?: string[];

    useActionId?: string;
} // closes ItemDefinition
```

---

# Runtime Inventory Stack

```ts
export interface InventoryStack {
    itemId: string;
    quantity: number;
} // closes InventoryStack
```

---

# Copilot Prompt

Implement a TypeScript item definition system for a mech game inventory.

Requirements:

* Create ItemDefinition interface
* Create InventoryStack interface
* Item categories are:

  * supplies
  * resources
  * parts
* Items use weightPerUnit in kilograms
* Runtime stacks only store:

  * itemId
  * quantity
* Do NOT store executable functions in item data
* Use useActionId string instead
* Include comments after every closing brace

Generate:

* interfaces
* example item definitions
* ItemDatabase singleton/service

---

# PHASE 2

# Inventory Manager

---

# Responsibilities

The InventoryManager should:

* add items
* remove items
* calculate cargo weight
* query quantities
* transfer items
* generate category lists
* handle stack merging

---

# Recommended Core Methods

```ts
addItem(itemId, quantity)

removeItem(itemId, quantity)

getQuantity(itemId)

hasItem(itemId, quantity)

getCargoWeight()

getItemsByCategory(category)

dropItem(itemId, quantity)

transferItem(...)
```

---

# Weight Calculation

```ts
cargoWeight =
sum(stack.quantity * item.weightPerUnit)
```

---

# IMPORTANT RULE

Inventory NEVER rejects items due to weight.

Overencumbrance is allowed.

Weight penalties are handled elsewhere.

---

# Copilot Prompt

Implement an InventoryManager system in TypeScript.

Requirements:

* Supports infinite logical stacks
* Items merge automatically by itemId
* Inventory never rejects items because of weight
* Weight penalties are handled externally
* InventoryManager calculates total cargo weight
* Supports:

  * addItem
  * removeItem
  * hasItem
  * getQuantity
  * getCargoWeight
  * getItemsByCategory
  * dropItem
* Use ItemDefinition lookup from ItemDatabase
* Use clean TypeScript architecture
* Include comments after every closing brace

---

# PHASE 3

# Weight Integration

---

# Goal

Integrate cargo weight into mech systems.

---

# Final Formula

```text id="jlwm7r"
Total Mech Weight =
Installed Part Weight +
Cargo Weight
```

---

# Important Rule

DO NOT create separate cargo penalties.

Existing mech weight systems already:

* reduce movement speed
* reduce acceleration
* reduce turn speed
* affect stagger resistance

Cargo simply contributes additional mass.

---

# Overencumbrance Thresholds

Recommended:

| Load Ratio | Effect  |
| ---------- | ------- |
| 0-100%     | Normal  |
| 100-150%   | Heavy   |
| 150-200%   | Severe  |
| 200%+      | Extreme |

---

# Copilot Prompt

Integrate cargo weight into the existing mech weight system.

Requirements:

* Total mech weight equals:
  installed part weight + cargo weight
* Inventory weight comes from InventoryManager
* Do NOT implement separate cargo penalties
* Existing movement/stat systems already respond to total weight
* Add configurable overencumbrance thresholds
* Thresholds should expose:

  * load ratio
  * state enum
* Include comments after every closing brace

---

# PHASE 4

# Inventory UI

---

# UI Structure

Tabs:

* Supplies
* Resources
* Parts

---

# Item Display Style

Use reusable item cards.

NO inspect button.

Each item card displays:

* name
* quantity
* total stack weight
* description
* actions

---

# Actions Per Category

| Category  | Actions     |
| --------- | ----------- |
| Supplies  | Use, Drop   |
| Resources | Drop        |
| Parts     | Equip, Drop |

---

# Accessibility Requirements

* fully keyboard navigable
* no grid inventory
* vertical card list
* predictable ordering
* screen-reader-friendly labels

---

# Suggested Card Layout

```text id="r8t6oj"
Item Name
Quantity
Total Weight

Description

Buttons
```

---

# Copilot Prompt

Implement an accessible inventory UI for a first-person audio mech game.

Requirements:

* Top tab categories:

  * Supplies
  * Resources
  * Parts
* Selected category displays vertical scrolling item cards
* Item cards display:

  * item name
  * quantity
  * total stack weight
  * description
* Buttons depend on category:

  * Supplies:
    Use, Drop
  * Resources:
    Drop
  * Parts:
    Equip, Drop
* Reuse existing card component architecture
* Fully keyboard accessible
* Predictable focus order
* No grid inventory
* Include comments after every closing brace

---

# PHASE 5

Copilot status: Complete
Developer status: Approved

# Loot System

---

# Loot Table Structure

```ts
export interface LootEntry {
    itemId: string;
    minQuantity: number;
    maxQuantity: number;
    dropChance: number;
} // closes LootEntry
```

---

# Loot Generation Rule

Each loot entry:

1. Roll dropChance
2. If successful:

   * choose random quantity
   * add to generated loot

---

# Entity Loot Philosophy

Loot is:

* entity-defined
* faction flavored
* mostly randomized

Example:

* science factions → energy cells
* raiders → ammo
* industrial enemies → materials

---

# Copilot Prompt

Implement a loot table system for a mech game.

Requirements:

* LootEntry contains:

  * itemId
  * minQuantity
  * maxQuantity
  * dropChance
* Loot generation rolls each entry independently
* Quantity chosen randomly within range
* Support entity-specific loot tables
* Support container-specific loot tables
* Return generated InventoryStacks
* Include comments after every closing brace

---

# PHASE 6

Copilot status: Complete
Developer status: Approved

# Pickup System

---

# Pickup Philosophy

## Auto Pickup

For:

* ammo resource
* coolant
* energy cells
* small common resources

---

## Interaction Pickup

For:

* wrecks
* containers
* parts
* weapons
* rare items

---

# IMPORTANT RULE

Player can ALWAYS pick up items.

Weight never blocks pickup.

---

# Copilot Prompt

Implement a hybrid pickup system for a mech game.

Requirements:

* Common small resources auto-pickup on contact
* Containers and larger loot sources require interaction key
* Player can always pick up items regardless of weight
* Overencumbrance is allowed
* Support:

  * loose pickups
  * loot containers
  * corpse/wreck containers
* Include accessibility-friendly interaction prompts
* Include comments after every closing brace

---

# PHASE 7

Copilot status: Complete
Developer status: Approved

# Containers

---

# Container Types

## Static Containers

Placed in world manually.

Examples:

* Supply Crates
* Hidden Stashes

---

## Runtime Containers

Generated dynamically.

Examples:

* Destroyed Mech Wrecks
* Enemy Corpses

---

# Recommended Container Schema

```ts
export interface LootContainer {
    id: string;

    name: string;

    position: Vector3;

    audioCueId?: string;

    items: InventoryStack[];

    rarityPriority: number;

    isPersistent: boolean;
} // closes LootContainer
```

---

# Copilot Prompt

Implement a loot container system.

Requirements:

* Support:

  * static world containers
  * runtime generated containers
* Containers store InventoryStacks
* Containers support partial looting
* Empty containers may be removed automatically
* Include positional audio support
* Include comments after every closing brace

---

# PHASE 8

Copilot status: Complete
Developer status: Approved

# Persistence System

---

# Persistence Philosophy

World persistence is:

* chunk-based
* priority-based
* performance-aware

---

# Cleanup Priority

Remove first:

1. Common loose items
2. Old loose items
3. Common empty containers

Persist longest:

* rare items
* mission containers
* valuable containers

---

# Important Rule

Loose runtime drops do NOT persist through save/load.

Containers may persist.

---

# Copilot Prompt

Implement a chunk-based world item persistence system.

Requirements:

* Track loose items and containers by chunk
* Use priority-based cleanup
* Cleanup should remove:

  * old common items first
  * low priority items first
* Rare items persist longer
* Containers persist longer than loose items
* Runtime loose drops do not persist through save/load
* System must enforce configurable performance limits
* Include comments after every closing brace

---

# PHASE 9

Copilot status: Complete
Developer status: Approved

# Audio Accessibility Integration

---

# Requirements

Every inventory interaction should support:

* screen readers
* keyboard-only navigation
* predictable focus
* unique audio cues

---

# Recommended Audio Categories

| Type       | Audio Identity     |
| ---------- | ------------------ |
| Ammo       | metallic           |
| Energy     | electrical         |
| Rockets    | heavy thunk        |
| Rare items | resonant/high-tech |
| Containers | industrial         |

---

# Important Rule

Avoid:

* spatial clutter
* too many simultaneous pickups
* excessive nested menus

---

# Final Notes

## DO NOT IMPLEMENT YET

* fabrication
* shops
* economy balancing
* repair crafting
* advanced persistence serialization

The current goal is:

# build the inventory foundation cleanly.

---

