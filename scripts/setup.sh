#!/bin/bash
set -e

echo "=== ChemSim Setup ==="

# Check prerequisites
command -v cmake >/dev/null 2>&1 || { echo "cmake required: brew install cmake"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "python3 required"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "node required"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm required"; exit 1; }

PROJ_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# 1. Install Python dependencies
echo "--- Installing Python dependencies ---"
pip install pybind11 fastapi "uvicorn[standard]" pydantic pydantic-settings python-multipart websockets

# 2. Build C++ engine
echo "--- Building C++ engine ---"
cd "$PROJ_DIR/engine"
mkdir -p build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_POLICY_VERSION_MINIMUM=3.5 \
    -Dpybind11_DIR=$(python3 -m pybind11 --cmakedir)
cmake --build . -j$(sysctl -n hw.ncpu 2>/dev/null || nproc)

# 3. Run C++ tests
echo "--- Running C++ tests ---"
cd "$PROJ_DIR/engine"
./build/chemsim_tests

# 4. Verify Python bindings
echo "--- Verifying Python bindings ---"
PYTHONPATH="$PROJ_DIR/engine/build" python3 -c "
import chemsim_engine
mol = chemsim_engine.parse_xyz('3\nwater\nO 0 0 0.117\nH 0 0.757 -0.469\nH 0 -0.757 -0.469\n')
print(f'Engine OK: parsed {mol.num_atoms()} atoms, {mol.num_bonds()} bonds')
"

# 5. Install frontend dependencies
echo "--- Installing frontend dependencies ---"
cd "$PROJ_DIR/frontend"
npm install

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To run the app:"
echo "  Terminal 1: cd $(basename "$PROJ_DIR") && ./scripts/dev.sh"
echo "  Open: http://localhost:3000"
