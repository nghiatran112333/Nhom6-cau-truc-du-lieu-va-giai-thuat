export const GRID_SIZE = 10;
export const CELL_SIZE = 2.0;
export const TERRAIN_TYPES = {
    grass:  { cost: 1,  color: 0x312e81, emissive: 0x1e1b4b, metalness: 0.1, roughness: 0.9 },
    forest: { cost: 3,  color: 0x064e3b, emissive: 0x022c22, hasTrees: true, metalness: 0.2, roughness: 1.0 },
    water:  { cost: 10, color: 0x1e40af, emissive: 0x1d4ed8, opacity: 0.8, metalness: 0.8, roughness: 0.2 },
    wall:   { cost: Infinity, color: 0xef4444, emissive: 0x991b1b, hasRocks: true, metalness: 0.6, roughness: 0.4 }
};
