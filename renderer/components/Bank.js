import { useState, useRef } from "react";
import {
  Box,
  Button,
  Center,
  Image,
  Input,
  RadioGroup,
  Radio,
  Text,
  Stack,
  Flex,
  Divider,
  Heading,
  Checkbox,
} from "@chakra-ui/react";
import useGameStore from "../hooks/useGameStore";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  fastGrowth,
  slowGrowth,
  erraticGrowth,
  mediumFastGrowth,
  mediumSlowGrowth,
  fluctuatingGrowth,
} from "../utils";

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

export default function Bank({ selectedPokemon, setSelectedPokemon }) {
  const parentRef = useRef(null);
  const [sortBy, setSortBy] = useState("id");
  const [isShiny, setIsShiny] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [release, setRelease] = useState(null);
  const swapPokemon = useGameStore((state) => state.swapPokemon);
  const bank = useGameStore((state) => state.player.bank);
  const releasePokemon = useGameStore((state) => state.releasePokemon);
  const setPokemon = (uuid) => {
    setSelectedPokemon((prev) => {
      if (prev.uuid === null) {
        return {
          uuid: uuid,
          place: "bank",
        };
      } else if (prev.uuid === uuid && prev.place === "bank") {
        return {
          uuid: null,
          place: null,
        };
      } else {
        swapPokemon(uuid, "bank", selectedPokemon.uuid, selectedPokemon.place);
        return {
          uuid: null,
          place: null,
        };
      }
    });
  };

  const pokemonBank = bank
    .sort((a, b) => {
      switch (sortBy) {
        case "id":
          return a.id - b.id;
        case "level":
          return b.level - a.level;
        case "name":
          return a.name.localeCompare(b.name);
        default:
          return a.id - b.id;
      }
    })
    .filter((poke) => poke.name.includes(searchTerm))
    .filter((poke) => {
      if (isShiny) {
        return poke.isShiny;
      } else {
        return true;
      }
    });

  const rowVirtualizer = useVirtualizer({
    count: pokemonBank.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 5,
  });

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  return (
    <Box
      w="100%"
      flexGrow={1}
      overflowY={"scroll"}
      scrollBehavior={"smooth"}
      ref={parentRef}
      sx={{
        "&::-webkit-scrollbar": { width: "9px" },
        "&::-webkit-scrollbar-track": { background: "transparent" },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: "gray.400",
          borderRadius: "24px",
          border: "2px solid transparent",
        },
      }}
    >
      <Box
        position={"sticky"}
        top={0}
        zIndex={1}
        backgroundColor={"white"}
        p={1}
        borderTopRadius={"md"}
      >
        <Heading size="md">Bank</Heading>
        <Center gap={2}>
          <RadioGroup value={sortBy} onChange={setSortBy}>
            <Stack direction="row" gap={8} align="center">
              <Radio value={"id"}>ID</Radio>
              <Radio value={"level"}>Level</Radio>
              <Radio value={"name"}>Name</Radio>
            </Stack>
          </RadioGroup>
          <Checkbox onChange={() => setIsShiny((prev) => !prev)}>
            Shiny Only
          </Checkbox>
        </Center>
        <Input value={searchTerm} onChange={handleSearch} size="xs" />
      </Box>
      <Flex direction="column">
        <Box
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((item) => {
            const pokemon = pokemonBank[item.index];
            const uuid = pokemon.uuid;
            return (
              <Center
                key={`${item.key}`}
                position="absolute"
                top={0}
                left={0}
                width="100%"
                flexDir={"column"}
                height={`${item.size}px`}
                transform={`translateY(${item.start}px)`}
              >
                <Center flexDir="row" w="100%" justifyContent={"space-between"}>
                  <Center
                    onClick={() => setPokemon(uuid)}
                    background={
                      selectedPokemon.uuid === pokemon.uuid ? "green.200" : null
                    }
                    borderRadius={"md"}
                  >
                    <Image alt={pokemon.name} src={pokemon.image} />
                    <Text>
                      {pokemon.name} Lvl. {pokemon.level}
                    </Text>
                  </Center>
                  <Button
                    colorScheme={uuid === release ? "red" : "gray"}
                    size="xs"
                    onClick={() => {
                      setSelectedPokemon({
                        uuid: null,
                        place: null,
                      });
                      if (uuid !== release) {
                        setRelease(uuid);
                      } else {
                        releasePokemon(uuid);
                        setRelease(null);
                      }
                    }}
                  >
                    Release
                  </Button>
                </Center>
                <Divider />
              </Center>
            );
          })}
        </Box>
      </Flex>
    </Box>
  );
}
