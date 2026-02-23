FROM python:3.12-slim AS builder

# Install build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Build C++ engine
COPY engine/ /app/engine/
RUN pip install pybind11 && \
    mkdir /app/engine/build && cd /app/engine/build && \
    cmake .. -DCMAKE_BUILD_TYPE=Release \
             -DCMAKE_POLICY_VERSION_MINIMUM=3.5 \
             -DBUILD_TESTS=OFF \
             -Dpybind11_DIR=$(python3 -m pybind11 --cmakedir) && \
    cmake --build . -j$(nproc)

# Runtime stage
FROM python:3.12-slim

COPY --from=builder /app/engine/build/chemsim_engine*.so /app/engine/build/

# Install Python dependencies
COPY backend/pyproject.toml /app/backend/
RUN pip install --no-cache-dir \
    fastapi uvicorn[standard] pydantic pydantic-settings \
    python-multipart websockets openai \
    numpy pyscf geometric

COPY backend/ /app/backend/

WORKDIR /app

ENV PYTHONPATH=/app/engine/build:/app/backend
ENV PORT=8000

EXPOSE 8000

CMD ["sh", "-c", "uvicorn chemsim_api.main:app --host 0.0.0.0 --port ${PORT}"]
