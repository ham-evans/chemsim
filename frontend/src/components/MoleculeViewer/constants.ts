// CPK coloring by atomic number
export const CPK_COLORS: Record<number, [number, number, number]> = {
  1: [1.0, 1.0, 1.0],       // H - white
  6: [0.56, 0.56, 0.56],    // C - dark gray
  7: [0.19, 0.31, 0.97],    // N - blue
  8: [1.0, 0.05, 0.05],     // O - red
  9: [0.56, 0.88, 0.31],    // F - green
  15: [1.0, 0.5, 0.0],      // P - orange
  16: [1.0, 1.0, 0.19],     // S - yellow
  17: [0.12, 0.94, 0.12],   // Cl - green
  35: [0.65, 0.16, 0.16],   // Br - dark red
  53: [0.58, 0.0, 0.58],    // I - purple
};

// Default color for unknown elements
export const DEFAULT_COLOR: [number, number, number] = [0.75, 0.0, 0.75];

// Atomic radii for rendering (scaled down from VdW radii)
export const ATOM_RADII: Record<number, number> = {
  1: 0.25,   // H
  2: 0.31,   // He
  6: 0.40,   // C
  7: 0.38,   // N
  8: 0.36,   // O
  9: 0.33,   // F
  15: 0.45,  // P
  16: 0.45,  // S
  17: 0.43,  // Cl
  35: 0.47,  // Br
  53: 0.53,  // I
};

export const DEFAULT_RADIUS = 0.40;
export const BOND_RADIUS = 0.08;
