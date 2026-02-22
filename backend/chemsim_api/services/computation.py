"""Computation service - shared queue infrastructure for WebSocket streaming."""
import asyncio
from typing import Optional


# Active calculation queues for WebSocket streaming
_calculation_queues: dict[str, asyncio.Queue] = {}


def get_queue(calc_id: str) -> Optional[asyncio.Queue]:
    return _calculation_queues.get(calc_id)


def create_queue(calc_id: str) -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue()
    _calculation_queues[calc_id] = q
    return q


def remove_queue(calc_id: str):
    _calculation_queues.pop(calc_id, None)
