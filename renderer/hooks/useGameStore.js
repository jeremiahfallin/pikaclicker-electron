import { create } from "zustand";
import { persist } from "zustand/middleware";
import superjson from "superjson";
import {
  checkEvolve,
  calcDamage,
  catchChance,
  createPokemon,
  experienceGain,
  getHexDetails,
  getWildPokemon,
  random,
  homeHex,
  legendaryNames,
  fastGrowth,
  slowGrowth,
  erraticGrowth,
  mediumFastGrowth,
  mediumSlowGrowth,
  fluctuatingGrowth,
} from "../utils";
import pokes from "../pokes";
import areas from "../areas";

const ballChances = {
  Pokeball: 1,
  "Great Ball": 1.5,
  "Ultra Ball": 2,
  Masterball: 255,
  Diveball: 3.5,
};

const levelFormulas = {
  erratic: erraticGrowth,
  fast: fastGrowth,
  "medium-fast": mediumFastGrowth,
  medium: mediumFastGrowth,
  "medium-slow": mediumSlowGrowth,
  slow: slowGrowth,
  fluctuating: fluctuatingGrowth,
  "slow-then-very-fast": fluctuatingGrowth,
};

const storage = {
  getItem: (name) => {
    const str = localStorage.getItem(name);
    if (!str) return null;
    return superjson.parse(str);
  },
  setItem: (name, value) => {
    localStorage.setItem(name, superjson.stringify(value));
  },
  removeItem: (name) => localStorage.removeItem(name),
};

const useGameStore = create(
  persist(
    (set, get) => ({
      battle: {
        pokemon: null,
        isTrainer: false,
        turn: 0,
        isComplete: false,
      },
      player: {
        currentHex: { q: 13, r: 2, s: 11 },
        party: [],
        bank: [],
        coins: 1000,
        pokedex: {
          seen: new Set(),
          caught: new Set(),
        },
        unlockedAreas: new Set(["Home"]),
        badges: new Set(),
        isInTown: true,
        items: [
          {
            name: "Pokeball",
            quantity: 10,
            type: "ball",
          },
        ],
        catchingStatus: "ALL",
      },
      clickMultiplier: 1,
      events: {
        pickStarter: 0,
      },
      settings: {
        ball: "Pokeball",
        newPokemon: true,
        repeatPokemon: true,
        shinyPokemon: true,
        legendaryPokemon: true,
        minimumIVPercent: 0,
      },
      attemptCatch: (pokemon) => {
        const player = get().player;
        const settings = get().settings;
        const pokedex = get().player.pokedex;
        const party = get().player.party;
        const items = get().player.items;
        const ball = items.find((item) => item.name === get().settings.ball);
        if (ball.quantity <= 0) {
          return;
        }
        const ballChance = ballChances[ball.name];
        const captureRate = pokemon.captureRate;
        const chance = catchChance(
          captureRate,
          pokemon.currentHP,
          pokemon.maxHP,
          1,
          ballChance,
          pokemon.level
        );
        const randomNum = random(0, 100);
        const { newPokemon, repeatPokemon, shinyPokemon, legendaryPokemon } =
          settings;
        const isCaught = pokedex.caught.has(pokemon.id);
        const isShiny = pokemon.isShiny;
        const isLegendary = [...legendaryNames, "cosmog"].includes(
          pokemon.name
        );

        if (
          (isShiny && shinyPokemon) ||
          (isCaught && repeatPokemon) ||
          (newPokemon && !isCaught) ||
          (isLegendary && legendaryPokemon)
        ) {
          if (randomNum <= chance) {
            if (party.length < 6) {
              const newParty = [...party, pokemon];
              set((state) => ({
                ...state,
                player: {
                  ...state.player,
                  party: newParty,
                },
              }));
            } else {
              const newPokemon = {
                ...pokemon,
                currentHP: pokemon.maxHP,
              };
              const newBank = [...player.bank, newPokemon];
              set((state) => ({
                ...state,
                player: {
                  ...state.player,
                  bank: newBank,
                },
              }));
            }
            set((state) => ({
              ...state,
              player: {
                ...state.player,
                pokedex: {
                  seen: new Set([...state.player.pokedex.seen, pokemon.id]),
                  caught: new Set([...state.player.pokedex.caught, pokemon.id]),
                },
              },
            }));
          } else {
            set((state) => ({
              ...state,
              player: {
                ...state.player,
                pokedex: {
                  seen: new Set([...state.player.pokedex.seen, pokemon.id]),
                  caught: state.player.pokedex.caught,
                },
              },
            }));
          }
          const newItems = items.map((item) => {
            if (item.name === get().settings.ball) {
              return {
                ...item,
                quantity: item.quantity - 1,
              };
            }
            return item;
          });
          set((state) => ({
            ...state,
            player: {
              ...state.player,
              items: newItems,
            },
          }));
        }
      },
      updateCurrentHex: (newHex) => {
        const unlockedAreas = get().player.unlockedAreas;
        const hex = getHexDetails(newHex.q, newHex.r);

        let hexArea =
          areas.find((area) =>
            area.hexes.some((h) => h.q === hex.q && h.r === hex.r)
          )?.name || "";

        if (!unlockedAreas.has(hexArea)) {
          return;
        }

        if (hex.isTown) {
          const { party } = get().player;
          const mimikyuBusted = party.filter(
            (poke) => poke.name === "mimikyu-busted"
          );
          if (mimikyuBusted.length > 0) {
            const newParty = party.map((poke) => {
              if (poke.name === "mimikyu-busted") {
                return {
                  ...poke,
                  ...createPokemon(
                    "mimikyu-disguised",
                    poke.level,
                    poke.uuid,
                    poke.isShiny,
                    poke.pokemonKnockedOut,
                    poke.bisharpKnockedOut,
                    poke.gender,
                    poke.happiness,
                    poke.affection
                  ),
                };
              }
              return poke;
            });
            get().updateParty(newParty);
          }
          set((state) => ({
            ...state,
            battle: {
              ...state.battle,
              pokemon: null,
              isTrainer: false,
              turn: 0,
              isComplete: false,
            },
            player: {
              ...state.player,
              isInTown: true,
              currentHex: { q: hex.q, r: hex.r },
              party: state.player.party.map((poke) => ({
                ...poke,
                currentHP: poke.maxHP,
              })),
            },
          }));
        } else {
          const { caught } = get().player.pokedex;
          let newPokemon = getWildPokemon(hex);
          // if legendary and already caught, reroll
          while (
            legendaryNames.includes(newPokemon.name) &&
            caught.has(newPokemon.id)
          ) {
            newPokemon = getWildPokemon(hex);
          }

          const { seen } = get().player.pokedex;
          if (!seen.has(newPokemon.id) && !newPokemon.id) {
            updatePokedex(newPokemon.id, false);
          }

          set((state) => ({
            ...state,
            battle: {
              ...state.battle,
              pokemon: [newPokemon],
            },
            player: {
              ...state.player,
              isInTown: false,
              currentHex: newHex,
            },
          }));
        }
      },
      updateParty: (newParty) => {
        set((state) => ({
          ...state,
          player: {
            ...state.player,
            party: newParty,
          },
        }));
      },
      updateBank: (newBank) => {
        set((state) => ({
          ...state,
          player: {
            ...state.player,
            bank: newBank,
          },
        }));
      },
      updateCoins: (newCoins) => {
        set((state) => ({
          ...state,
          player: {
            ...state.player,
            coins: newCoins,
          },
        }));
      },
      updateItems: (newItems) => {
        set((state) => ({
          ...state,
          player: {
            ...state.player,
            items: newItems,
          },
        }));
      },
      updatePokedex: (newPokedex) => {
        set((state) => ({
          ...state,
          player: {
            ...state.player,
            pokedex: newPokedex,
          },
        }));
      },
      updateEvent: (event, value) => {
        set((state) => ({
          ...state,
          events: {
            ...state.events,
            [event]: value,
          },
        }));
      },
      updateBattle: (payload) => {
        set((state) => ({
          ...state,
          battle: {
            ...state.battle,
            ...payload,
          },
        }));
      },
      updatePlayer: (payload) => {
        set((state) => ({
          ...state,
          player: {
            ...state.player,
            ...payload,
          },
        }));
      },
      swapPokemon: (uuid1, place1, uuid2, place2) => {
        // swaps pokemon, may swap between just party, just bank, or party and bank
        const isInTown = get().player.isInTown;
        const party = get().player.party;
        const bank = get().player.bank;
        const battleLength = get().battle.pokemon?.length || 0;
        if (isInTown && battleLength === 0) {
          if (place1 === "party" && place2 === "party") {
            const idx1 = party.findIndex((poke) => poke.uuid === uuid1);
            const idx2 = party.findIndex((poke) => poke.uuid === uuid2);
            const newParty = [...party];
            const temp = newParty[idx1];
            newParty[idx1] = newParty[idx2];
            newParty[idx2] = temp;
            get().updateParty(newParty);
          } else if (place1 === "bank" && place2 === "bank") {
            const idx1 = bank.findIndex((poke) => poke.uuid === uuid1);
            const idx2 = bank.findIndex((poke) => poke.uuid === uuid2);
            const newBank = [...bank];
            const temp = newBank[idx1];
            newBank[idx1] = newBank[idx2];
            newBank[idx2] = temp;
            get().updateBank(newBank);
          } else if (place1 === "party" && place2 === "bank") {
            const idx1 = party.findIndex((poke) => poke.uuid === uuid1);
            const idx2 = bank.findIndex((poke) => poke.uuid === uuid2);
            const newParty = [...party];
            const newBank = [...bank];
            let temp = newParty[idx1];
            if (temp.name === "shaymin-sky") {
              temp = createPokemon(
                "shaymin-land",
                temp.level,
                temp.uuid,
                temp.isShiny,
                temp.pokemonKnockedOut,
                temp.bisharpKnockedOut,
                temp.gender,
                temp.happiness,
                temp.affection
              );
            }
            if (temp.name === "zacian-crowned") {
              temp = createPokemon(
                "zacian",
                temp.level,
                temp.uuid,
                temp.isShiny,
                temp.pokemonKnockedOut,
                temp.bisharpKnockedOut,
                temp.gender,
                temp.happiness,
                temp.affection
              );
            }
            if (temp.name === "zamazenta-crowned") {
              temp = createPokemon(
                "zamazenta",
                temp.level,
                temp.uuid,
                temp.isShiny,
                temp.pokemonKnockedOut,
                temp.bisharpKnockedOut,
                temp.gender,
                temp.happiness,
                temp.affection
              );
            }
            newParty[idx1] = newBank[idx2];
            newBank[idx2] = temp;
            get().updateParty(newParty);
            get().updateBank(newBank);
          } else if (place1 === "bank" && place2 === "party") {
            const idx1 = bank.findIndex((poke) => poke.uuid === uuid1);
            const idx2 = party.findIndex((poke) => poke.uuid === uuid2);
            const newParty = [...party];
            const newBank = [...bank];
            let temp = newBank[idx1];
            if (temp.name === "shaymin-sky") {
              temp = createPokemon(
                "shaymin-land",
                temp.level,
                temp.uuid,
                temp.isShiny,
                temp.pokemonKnockedOut,
                temp.bisharpKnockedOut,
                temp.gender,
                temp.happiness,
                temp.affection
              );
            }
            if (temp.name === "zacian-crowned") {
              temp = createPokemon(
                "zacian",
                temp.level,
                temp.uuid,
                temp.isShiny,
                temp.pokemonKnockedOut,
                temp.bisharpKnockedOut,
                temp.gender,
                temp.happiness,
                temp.affection
              );
            }
            if (temp.name === "zamazenta-crowned") {
              temp = createPokemon(
                "zamazenta",
                temp.level,
                temp.uuid,
                temp.isShiny,
                temp.pokemonKnockedOut,
                temp.bisharpKnockedOut,
                temp.gender,
                temp.happiness,
                temp.affection
              );
            }
            newBank[idx1] = newParty[idx2];
            newParty[idx2] = temp;
            get().updateParty(newParty);
            get().updateBank(newBank);
          }
        }
      },
      releasePokemon: (uuid) => {
        const player = get().player;
        const bank = player.bank;
        const newBank = [...bank];
        const idx = newBank.findIndex((poke) => poke.uuid === uuid);
        const releasedPokemon = newBank[idx];
        newBank.splice(idx, 1);
        get().updateBank(newBank);
        get().updateExperience(releasedPokemon);
      },
      updateExperience: (pokemon) => {
        const newParty = get().player.party.map((poke) => {
          const newExperience =
            poke.xp +
            experienceGain(pokemon.baseExperience, pokemon.level, poke.level);
          const nextLevelExperience = levelFormulas[poke.growthRate](
            poke.level + 1
          );
          let newLevel = poke.level;
          if (newExperience >= nextLevelExperience) {
            newLevel = poke.level + 1;
          }

          if (newLevel > poke.level) {
            const evolutionName = checkEvolve(poke, newLevel);

            if (!!evolutionName) {
              const evolution = pokes.find((p) => p.name === evolutionName);
              updatePokedex(evolution.id, true);
              const newPokemon = createPokemon(
                evolution.name,
                newLevel,
                poke.uuid,
                poke.isShiny,
                poke.pokemonKnockedOut,
                poke.bisharpKnockedOut,
                poke.gender,
                poke.happiness,
                poke.affection
              );
              return {
                ...poke,
                ...newPokemon,
                level: newLevel,
                xp: newExperience,
              };
            }

            return {
              ...poke,
              ...createPokemon(
                poke.name,
                newLevel,
                poke.uuid,
                poke.isShiny,
                poke.pokemonKnockedOut,
                poke.bisharpKnockedOut,
                poke.gender,
                poke.happiness,
                poke.affection
              ),
              level: newLevel,
              xp: newExperience,
            };
          } else {
            return {
              ...poke,
              xp: newExperience,
            };
          }
        });
        get().updateParty(newParty);
      },
      updateHappiness: () => {
        const newParty = get().player.party.map((poke) => {
          const newHappiness = Math.min(255, poke.happiness + 1);
          return {
            ...poke,
            happiness: newHappiness,
          };
        });
        get().updateParty(newParty);
      },
      updateKnockedOut: (pokemon) => {
        const party = get().player.party;
        const leadPokemon = party[0];
        if (pokemon === "bisharp") {
          const newParty = [
            {
              ...leadPokemon,
              pokemonKnockedOut: leadPokemon.pokemonKnockedOut + 1 || 1,
              bisharpKnockedOut: leadPokemon.bisharpKnockedOut + 1 || 1,
            },
            ...party.slice(1),
          ];
          get().updateParty(newParty);
        } else {
          const newParty = [
            {
              ...leadPokemon,
              pokemonKnockedOut: leadPokemon.pokemonKnockedOut + 1 || 1,
            },
            ...party.slice(1),
          ];
          get().updateParty(newParty);
        }
      },
      applyItemOnPokemon: (item, uuid, place) => {
        const idx = get().player[place].findIndex((poke) => poke.uuid === uuid);
        const pokemon = get().player[place][idx];
        const newPlace = [...get().player[place]];
        const newItems = [...get().player.items];
        const itemIndex = newItems.findIndex((i) => i.name === item.name);
        if (
          item.type === "evolution-item" &&
          newItems[itemIndex].quantity >= 0
        ) {
          const basePokemon = pokes.find((p) => p.id === pokemon.id);
          const evolutionName = checkEvolve(basePokemon, null, null, item.slug);
          let itemsNeeded = 1;
          if (evolutionName === "gholdengo") {
            itemsNeeded = 999;
          }
          if (newItems[itemIndex].quantity < itemsNeeded) {
            return;
          }
          if (!!evolutionName) {
            const evolution = pokes.find((p) => p.name === evolutionName);
            const newPokemon = createPokemon(
              evolution.name,
              pokemon.level,
              pokemon.uuid,
              pokemon.isShiny,
              pokemon.pokemonKnockedOut,
              pokemon.bisharpKnockedOut,
              pokemon.gender,
              pokemon.happiness,
              pokemon.affection
            );
            newPlace[idx] = {
              ...pokemon,
              ...newPokemon,
            };
            newItems[itemIndex].quantity -= itemsNeeded;
            if (newItems[itemIndex].quantity <= 0) {
              newItems.splice(itemIndex, 1);
            }
            if (place === "party") {
              get().updateParty(newPlace);
            } else {
              get().updateBank(newPlace);
            }
            get().updateItems(newItems);
            updatePokedex(evolution.id, true);
          }
        }
      },
      updateClickMultiplier: (multiplier) => {
        set((state) => ({
          ...state,
          clickMultiplier: multiplier,
        }));
      },
      handleClick: () => {
        const { battle, player } = get();
        const { pokemon } = battle;
        if (!pokemon) {
          return;
        }

        const { party } = player;
        const playerPokemon = party[0];
        const enemyPokemon = pokemon[0];
        if (enemyPokemon.currentHP === 0) {
          get().updateCoins(
            player.coins +
              Math.floor(
                10 +
                  5 *
                    Math.sqrt(enemyPokemon.level) *
                    Math.log(enemyPokemon.level)
              )
          );
          get().updateExperience(enemyPokemon);
          get().updateHappiness();
          get().updateKnockedOut(enemyPokemon.name);
          if (enemyPokemon.name === "gimmighoul") {
            const newItems = [...player.items];
            const itemIndex = newItems.findIndex(
              (i) => i.slug === "gimmighoul-coins"
            );
            if (itemIndex === -1) {
              newItems.push({
                name: "Gimmighoul Coins",
                slug: "gimmighoul-coins",
                quantity: 1,
                type: "evolution-item",
              });
            } else {
              newItems[itemIndex].quantity += 1;
            }
            get().updateItems(newItems);
          }

          if (battle.isTrainer) {
            const battlePokemon = get().battle.pokemon;
            const newTrainerPokemon = battlePokemon.findIndex((poke) => {
              return poke.currentHP > 0;
            });
            if (newTrainerPokemon === -1) {
              get().updateBattle({
                pokemon: null,
                isTrainer: false,
                turn: 0,
                isComplete: true,
              });
              return;
            } else {
              get().updateBattle({
                pokemon: [
                  battlePokemon[newTrainerPokemon],
                  ...battlePokemon.slice(0, newTrainerPokemon),
                  ...battlePokemon.slice(newTrainerPokemon + 1),
                ],
              });
            }
            return;
          }

          if (!battle.isTrainer && player.catchingStatus === "ALL") {
            get().attemptCatch(pokemon[0]);
            get().updateCurrentHex(player.currentHex);
            return;
          }
        }
        if (!get()?.clickMultiplier) {
          get().updateClickMultiplier(1);
        }
        const dmgDealt =
          (get().clickMultiplier / 10) *
          calcDamage(
            playerPokemon.level,
            Math.max(playerPokemon.attack, playerPokemon.spAttack),
            20,
            playerPokemon.attack > playerPokemon.spAttack
              ? enemyPokemon.defense
              : enemyPokemon.spDefense,
            1,
            1
          );
        const newEnemyHP = Math.max(enemyPokemon.currentHP - dmgDealt, 0);
        const newEnemyPokemon = {
          ...enemyPokemon,
          currentHP: newEnemyHP,
        };
        const newPokemon = [newEnemyPokemon, ...pokemon.slice(1)];
        get().updateBattle({
          pokemon: newPokemon,
        });
      },
      handleTurn: (initiative) => {
        const isPlayerTurn = initiative === "player";
        const { battle, player } = get();
        let { pokemon } = battle;
        const { party } = player;

        if (!pokemon) {
          return;
        }
        pokemon = pokemon[0];

        if (party[0].currentHP === 0) {
          const newLeadPokemon = party.findIndex((poke) => {
            return poke.currentHP > 0;
          });
          if (newLeadPokemon === -1) {
            get().updateCurrentHex(homeHex);
            return;
          } else {
            get().updateParty([
              party[newLeadPokemon],
              ...party.slice(0, newLeadPokemon),
              ...party.slice(newLeadPokemon + 1),
            ]);
          }
          return;
        }
        if (pokemon.currentHP === 0) {
          get().updateCoins(
            player.coins +
              Math.floor(
                10 + 5 * Math.sqrt(pokemon.level) * Math.log(pokemon.level)
              )
          );
          get().updateExperience(pokemon);
          get().updateHappiness();
          get().updateKnockedOut(pokemon.name);
          if (pokemon.name === "gimmighoul") {
            const newItems = [...player.items];
            const itemIndex = newItems.findIndex(
              (i) => i.slug === "gimmighoul-coins"
            );
            if (itemIndex === -1) {
              newItems.push({
                name: "Gimmighoul Coins",
                slug: "gimmighoul-coins",
                quantity: 1,
                type: "evolution-item",
              });
            } else {
              newItems[itemIndex].quantity += 1;
            }
            get().updateItems(newItems);
          }

          if (battle.isTrainer) {
            const battlePokemon = get().battle.pokemon;
            const newTrainerPokemon = battlePokemon.findIndex((poke) => {
              return poke.currentHP > 0;
            });
            if (newTrainerPokemon === -1) {
              get().updateBattle({
                pokemon: null,
                isTrainer: false,
                turn: 0,
                isComplete: true,
              });
              return;
            } else {
              get().updateBattle({
                pokemon: [
                  battlePokemon[newTrainerPokemon],
                  ...battlePokemon.slice(0, newTrainerPokemon),
                  ...battlePokemon.slice(newTrainerPokemon + 1),
                ],
              });
            }
            return;
          }

          if (!battle.isTrainer && player.catchingStatus === "ALL") {
            get().attemptCatch(pokemon);
            get().updateCurrentHex(player.currentHex);
            return;
          }
        }
        let playerPokemon = party[0];

        const enemyPokemon = pokemon;
        const criticalAttack = random(0, 25) === 0 ? 1.5 : 1;
        const criticalDefense = random(0, 25) === 0 ? 1.5 : 1;
        const dmgTaken =
          calcDamage(
            enemyPokemon.level,
            Math.max(enemyPokemon.attack, enemyPokemon.spAttack),
            20,
            enemyPokemon.attack > enemyPokemon.spAttack
              ? playerPokemon.defense
              : playerPokemon.spDefense,
            1,
            1
          ) / criticalDefense;
        const dmgDealt =
          calcDamage(
            playerPokemon.level,
            Math.max(playerPokemon.attack, playerPokemon.spAttack),
            20,
            playerPokemon.attack > playerPokemon.spAttack
              ? enemyPokemon.defense
              : enemyPokemon.spDefense,
            1,
            1
          ) * criticalAttack;
        if (
          playerPokemon.name === "aegislash-blade" &&
          initiative === undefined &&
          criticalDefense === 1.5
        ) {
          const party = get().player.party;
          const idx = party.findIndex(
            (poke) => poke.uuid === playerPokemon.uuid
          );
          const newParty = [...party];
          const newPokemon = createPokemon(
            "aegislash-shield",
            playerPokemon.level,
            playerPokemon.uuid,
            playerPokemon.isShiny,
            playerPokemon.pokemonKnockedOut,
            playerPokemon.bisharpKnockedOut,
            playerPokemon.gender,
            playerPokemon.happiness,
            playerPokemon.affection
          );
          newParty[idx] = {
            ...playerPokemon,
            ...newPokemon,
            currentHP: playerPokemon.currentHP,
          };
          get().updateParty(newParty);
          updatePokedex(newPokemon.id, true);
          playerPokemon = newPokemon;
        } else if (
          playerPokemon.name === "aegislash-shield" &&
          initiative === "player" &&
          criticalAttack === 1.5
        ) {
          const party = get().player.party;
          const idx = party.findIndex(
            (poke) => poke.uuid === playerPokemon.uuid
          );
          const newParty = [...party];
          const newPokemon = createPokemon(
            "aegislash-blade",
            playerPokemon.level,
            playerPokemon.uuid,
            playerPokemon.isShiny,
            playerPokemon.pokemonKnockedOut,
            playerPokemon.bisharpKnockedOut,
            playerPokemon.gender,
            playerPokemon.happiness,
            playerPokemon.affection
          );
          newParty[idx] = {
            ...playerPokemon,
            ...newPokemon,
            currentHP: playerPokemon.currentHP,
          };
          get().updateParty(newParty);
          updatePokedex(newPokemon.id, true);
          playerPokemon = newPokemon;
        }
        if (
          initiative === undefined &&
          dmgTaken > 0 &&
          playerPokemon.name === "mimikyu-disguised"
        ) {
          const party = get().player.party;
          const idx = party.findIndex(
            (poke) => poke.uuid === playerPokemon.uuid
          );
          const newParty = [...party];
          const newPokemon = createPokemon(
            "mimikyu-busted",
            playerPokemon.level,
            playerPokemon.uuid,
            playerPokemon.isShiny,
            playerPokemon.pokemonKnockedOut,
            playerPokemon.bisharpKnockedOut,
            playerPokemon.gender,
            playerPokemon.happiness,
            playerPokemon.affection
          );
          newParty[idx] = {
            ...playerPokemon,
            ...newPokemon,
            currentHP: playerPokemon.currentHP,
          };
          get().updateParty(newParty);
          updatePokedex(newPokemon.id, true);
          playerPokemon = newPokemon;
        }
        const newPlayerHP = Math.max(playerPokemon.currentHP - dmgTaken, 0);
        if (isPlayerTurn) {
          get().updateBattle({
            turn: get().battle.turn + 1,
            pokemon: [
              {
                ...pokemon,
                currentHP: Math.max(pokemon.currentHP - dmgDealt, 0),
              },
              ...get().battle.pokemon.slice(1),
            ],
          });
        } else {
          get().updatePlayer({
            party: [
              {
                ...playerPokemon,
                currentHP:
                  newPlayerHP > 0
                    ? Math.min(playerPokemon.maxHP, newPlayerHP)
                    : 0,
              },
              ...party.slice(1),
            ],
          });
        }
      },
    }),
    {
      name: "pokeclicker",
      storage,
    }
  )
);

// Function to update the Pokédex
function updatePokedex(id, isCaught) {
  useGameStore.setState((state) => ({
    ...state,
    player: {
      ...state.player,
      pokedex: {
        ...state.player.pokedex,
        seen: new Set([...state.player.pokedex.seen, id]),
        caught: isCaught
          ? new Set([...state.player.pokedex.caught, id])
          : state.player.pokedex.caught,
      },
    },
  }));
}

// Function to unlock new game areas
function unlockArea(area) {
  useGameStore.setState((state) => ({
    ...state,
    player: {
      ...state.player,
      unlockedAreas: new Set([...state.player.unlockedAreas, area]),
    },
  }));
}

// Function to update player badges
function updateBadges(badge) {
  if (badge === "Grass") {
    unlockArea("Area 2");
    unlockArea("Volcano Town");
  }
  if (badge === "Fire") {
    unlockArea("Area 3");
    unlockArea("Area 6");
    unlockArea("Swamp Town");
  }
  if (badge === "Swamp") {
    unlockArea("Area 4");
    unlockArea("Rock Town");
  }
  if (badge === "Rock") {
    unlockArea("Area 5");
    unlockArea("Electric Town");
  }
  if (badge === "Electric") {
    unlockArea("Area 10");
    unlockArea("Area 11");
    unlockArea("Desert Town");
  }
  if (badge === "Desert") {
    unlockArea("Area 7");
    unlockArea("Flying Town");
  }
  if (badge === "Flying") {
    unlockArea("Area 8");
    unlockArea("Area 9");
    unlockArea("Ice Town");
  }
  if (badge === "Ice") {
    unlockArea("Area 12");
    unlockArea("Area 13");
    unlockArea("Fossil Town");
  }
  if (badge === "Fossil") {
    unlockArea("Area 14");
    unlockArea("Area 15");
    unlockArea("Elite 4");
  }
  if (badge === "Elite4") {
    unlockArea("Champion");
  }

  useGameStore.setState((state) => ({
    ...state,
    player: {
      ...state.player,
      badges: new Set([...state.player.badges, badge]),
    },
  }));
}

// Function to handle defeating a pokemon
function defeatPokemon() {}

export { unlockArea, updatePokedex, updateBadges };
export default useGameStore;
