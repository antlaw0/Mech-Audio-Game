# Garage and Parts Editor Implementation
I want to pause the ImplementationRoadMap to implement this Garage and Parts System.


##  Overview
I need you to implement a full parts and Garage system. The garage is where all the mech parts the player owns are stored. The Garage is a UI for viewing parts and swapping in and out different parts on the player's current mech. The UI should consist of a vertical list of part categories on the left hand pane such as "Head", "Computer", etc all the way to "Utility 1" and "utility 2". These should be buttons where one can be selected at a time. In the main pane in the center of the screen should be the list of all the parts within that category that the player owns in their garage. There will need to be one base "Parts Card" component so can be reused when displaying parts anywhere in any UI in the game. Part cards should consist of the name of the part as a heading (most likely heading level 2), then the statistics  corresponding to that part category, i.e. damage for weapons, energy capacity for generators, etc. Product cards should display all the relevant player-facing stats. Use this part card component anywhere in the game parts are displayed in this manner. While in the garage, part cards should have a button for "Equip Part to mech". This should bring up a modal dialogue that Asks the player if they are sure they want to install this part on their mech. If the corresponding part slot on the current player mech is empty, equip the part to that slot if the player selects "Yes". If that part slot already has a part occupying that slot, The dialogue box should Say "Are you sure you want to swap this part?" Then it should show the selected garage part's part card to the left of the currently equipped part's part card so player can compare and either say "yes" to make the switch or "No" to abort the swap. If yes, the selected garage part is installed equipped to the player's mech while the previously equipped part goes into the same garage part list for future viewing and perhaps reinstallation. This confirmation dialogue should also warn if this will equipping this part will put the mech weight over either the ground carry limit or flight carry limit or if this part is otherwise incompatible with the current mech build. 

I also want to use this same garage UI to serve as my developer parts catalog tool to add, remove, and edit the full parts catalog. Switching to developer mode should make it so the center pane that lists all the parts now lists all the currently defined parts from the full parts catalog. Developer mode is toggled in dev command "dev mode on" and dev mode off". So selecting "Head" in the left now lists all the defined head parts in the entire game as defined in the parts catalog. The same part card should present in a list but now there is a "Edit" button since in developer mode where each stat has an edit field where I can edit the stats for that part definition in the partrs catalog. in addition to the edit button, should also be a "delete" button that pops a dialogue box to confirm if i really want to delete this part from th catalog. Then at the top of this list of part cards, should be an "Add new part" button where it pops up the same edit form except that once I press submit, this new part definition is added to the parts catalog. The parts catalog should be a json file of all the parts defined in the game. this is what the game uses for part definitions and what is loaded during this developer editing process. The catalog json file should update in realtime as I make additions, deletions or edits. Type script should still be the single source of truth.
Parts spawned in the game should be unique instances of these part definitions in the parts catalog. So every single part needs a unique ID. This is because players will be able to modify parts and the actual instance of the part should be the one modified and never the definition in the parts catalog. For example, The player has two "Basic Head" parts in their garage inventory. One has 125/125 integrity whereas the other has 34/125 integrity. Then the player applies a range upgrade to the first Basic Head that increases its range stat by 10%. This head's range was 100 but after the upgrade, the stat is now 110. And the other head who has not had its range modified from the base definition in the parts catalog still has range of 100. I am also planning to utilize a Diablo II style loot randomizer so parts are modified at random based on predefined perameters.

## 0. NON-NEGOTIABLE ARCHITECTURE RULES

* Part definitions and part instances are ALWAYS separate.
* The Garage system is CLIENT-SIDE ONLY.
* Server simulation and ECS must NOT be modified for Garage functionality.
* No gameplay system (combat, movement, world tick) may depend on Garage UI.
* Shared code in `packages/shared` must NOT contain UI logic or inventory UI logic.

---

## 1. DATA MODEL (MANDATORY)

### PartDefinition (catalog, static)

Represents design-time part data loaded from JSON.

```ts
type PartDefinition = {
  id: string; // stable key, e.g. "basic.generator"
  name: string;
  category: PartCategory;

  integrity: number;
  weight: number;

  PDEF: number;
  EDEF: number;
  energyDrain: number;

  // optional category-specific fields allowed via extension
};
```

---

### PartInstance (runtime owned item)

Represents a unique owned item.

```ts
type PartInstance = {
  instanceId: string; // unique runtime ID
  definitionId: string;

  currentIntegrity: number;

  modifiers: PartModifier[];

  installedChips: string[];

  rngSeed: number;
};
```

---

### PartModifier

Used for Diablo-style effects.

```ts
type PartModifier = {
  id: string;
  type: "stat_mult" | "stat_add" | "special";
  stat: string;
  value: number;
};
```

---

### MechLoadout

```ts
type MechLoadout = {
  Head?: string;
  Computer?: string;
  Core?: string;
  Generator?: string;

  LeftArm?: string;
  RightArm?: string;

  Utility1?: string;
  Utility2?: string;
};
```

Values reference `instanceId`.

---

## 2. PART CATALOG SYSTEM

### Location

Create:

```
packages/client/src/data/parts/
```

### Structure

* `parts.json` → authoritative catalog
* loaded at runtime into memory

### Rules

* JSON is the ONLY runtime source of truth for definitions
* TS types define structure only
* Dev mode can modify JSON live (client-side persistence)

---

## 3. GARAGE SYSTEM (CLIENT ONLY)

### Location

Create:

```
packages/client/src/ui/garage/
```

---

### Responsibilities

Garage must:

* display owned PartInstances
* filter by category
* allow equip/unequip
* handle swap confirmation
* enforce compatibility checks
* show warnings (weight, slot mismatch)

---

### UI Layout

Left panel:

* category list (Head, Computer, Core, etc.)

Center panel:

* list of PartCards for selected category

PartCard:

* reusable UI component across game

---

## 4. PART CARD COMPONENT (REUSABLE)

### Location

```
src/ui/components/PartCard.ts
```

Must support:

* display PartInstance OR PartDefinition
* show relevant stats based on category
* optional action buttons:

  * Equip
  * Edit (dev mode only)
  * Delete (dev mode only)

---

## 5. EQUIP SYSTEM

### Rules

* Equip uses instanceId
* Slot must match category
* Swap moves previous instance back to garage
* Must show confirmation modal

### Validation checks:

* weight limits (ground + flight)
* slot compatibility
* missing required slots
* warnings do NOT block equip unless explicitly invalid

---

## 6. DEV MODE (GARAGE EXTENSION)

### Activation

Triggered by dev console:

```
dev mode on
dev mode off
```

---

### Behavior changes:

* Center list switches from PartInstances → PartDefinitions
* Adds:

  * Add Part button
  * Edit button per part
  * Delete button per part

---

### Editing rules:

* edits modify JSON catalog in real time
* changes persist immediately (debounced save)
* no runtime simulation impact until reload OR hot reload hook

---

### Delete rules:

* must show confirmation modal
* deletion marks part as "deprecated" rather than hard removal if referenced

---

## 7. SAVE SYSTEM RULES

* Garage inventory persists locally on client
* Part catalog persists in JSON file
* PartInstances must never be merged into catalog

---

## 8. STAT RESOLUTION SYSTEM (MANDATORY NEW MODULE)

Create:

```
src/systems/parts/statResolver.ts
```

Function:

```ts
getFinalPartStats(instanceId): ResolvedStats
```

Rules:

* base definition stats
* * modifiers
* * chips
* * damage penalties
* NEVER mutate original instance or definition

---

## 9. INTEGRATION RULES

Garage may read:

* player inventory store
* player loadout state

Garage may NOT:

* directly modify ECS systems
* directly modify server state
* directly mutate world simulation

All changes flow:

```
Garage → Player Loadout State → Simulation reads it
```

NOT:

```
Garage → ECS directly ❌
```

---

## 10. IMPLEMENTATION PHASES

### Phase 1 — Garage UI foundation

* category list
* part list
* PartCard component
* view-only mode

### Phase 2 — Inventory + equip system

* instance system
* equip/unequip
* swap modal

### Phase 3 — Stat resolution system

* modifiers
* chips
* derived stats

### Phase 4 — Dev mode editor

* catalog JSON editing
* add/delete/edit parts
* live persistence
