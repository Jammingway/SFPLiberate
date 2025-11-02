"""
BLE Proxy WebSocket endpoint.

Provides WebSocket connection for BLE communication, allowing Safari/iOS
users to access SFP Wizard via the backend as a proxy.
"""

import asyncio
import base64
import json
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.schemas.ble import (
    BLEConnectedMessage,
    BLEConnectMessage,
    BLEDisconnectedMessage,
    BLEDisconnectMessage,
    BLEDiscoveredMessage,
    BLEDiscoverMessage,
    BLEErrorMessage,
    BLEMessageType,
    BLENotificationMessage,
    BLEStatusMessage,
    BLESubscribeMessage,
    BLEUnsubscribeMessage,
    BLEWriteMessage,
)
from app.services.ble_manager import BLENotAvailableError, get_ble_manager

logger = logging.getLogger(__name__)
router = APIRouter()


class BLEProxyHandler:
    """Handles WebSocket connection and BLE operations for a single client."""

    def __init__(self, websocket: WebSocket):
        """
        Initialize handler.

        Args:
            websocket: FastAPI WebSocket connection
        """
        self.websocket = websocket
        self.ble_manager = None
        self.running = False

    async def handle(self) -> None:
        """Main handler loop for WebSocket connection."""
        await self.websocket.accept()
        self.running = True

        try:
            # Check if BLE proxy is available
            try:
                self.ble_manager = get_ble_manager()
            except BLENotAvailableError as e:
                await self.send_error(
                    f"BLE Proxy not available: {e}. "
                    "Install with: poetry install -E ble-proxy"
                )
                return

            # Send initial status
            await self.send_status(connected=False, message="BLE Proxy ready")

            # Main message loop
            while self.running:
                try:
                    data = await self.websocket.receive_text()
                    await self.handle_message(data)
                except WebSocketDisconnect:
                    logger.info("Client disconnected")
                    break
                except Exception as e:
                    logger.error(f"Error handling message: {e}", exc_info=True)
                    await self.send_error(f"Error handling message: {e}")

        finally:
            # Cleanup
            if self.ble_manager and self.ble_manager.is_connected:
                try:
                    await self.ble_manager.disconnect()
                except Exception as e:
                    logger.error(f"Error during cleanup: {e}")
            self.running = False

    async def handle_message(self, data: str) -> None:
        """
        Handle incoming WebSocket message.

        Args:
            data: JSON string message from client
        """
        try:
            message = json.loads(data)
            msg_type = message.get("type")

            if msg_type == BLEMessageType.CONNECT:
                await self.handle_connect(BLEConnectMessage(**message))
            elif msg_type == BLEMessageType.DISCONNECT:
                await self.handle_disconnect(BLEDisconnectMessage(**message))
            elif msg_type == BLEMessageType.WRITE:
                await self.handle_write(BLEWriteMessage(**message))
            elif msg_type == BLEMessageType.SUBSCRIBE:
                await self.handle_subscribe(BLESubscribeMessage(**message))
            elif msg_type == BLEMessageType.UNSUBSCRIBE:
                await self.handle_unsubscribe(BLEUnsubscribeMessage(**message))
            elif msg_type == BLEMessageType.DISCOVER:
                await self.handle_discover(BLEDiscoverMessage(**message))
            else:
                await self.send_error(f"Unknown message type: {msg_type}")

        except ValidationError as e:
            await self.send_error(f"Invalid message format: {e}")
        except json.JSONDecodeError as e:
            await self.send_error(f"Invalid JSON: {e}")

    async def handle_connect(self, message: BLEConnectMessage) -> None:
        """Handle connect request."""
        try:
            device_info = await self.ble_manager.connect(
                service_uuid=message.service_uuid, device_address=message.device_address
            )

            response = BLEConnectedMessage(
                device_name=device_info["name"],
                device_address=device_info["address"],
                services=device_info["services"],
            )
            await self.send_message(response.model_dump())

        except Exception as e:
            logger.error(f"Connect failed: {e}")
            await self.send_error(f"Connect failed: {e}")

    async def handle_disconnect(self, message: BLEDisconnectMessage) -> None:
        """Handle disconnect request."""
        try:
            await self.ble_manager.disconnect()
            response = BLEDisconnectedMessage(reason="User requested disconnect")
            await self.send_message(response.model_dump())

        except Exception as e:
            logger.error(f"Disconnect failed: {e}")
            await self.send_error(f"Disconnect failed: {e}")

    async def handle_write(self, message: BLEWriteMessage) -> None:
        """Handle write request."""
        try:
            # Decode base64 data
            data = base64.b64decode(message.data)

            # Write to characteristic
            await self.ble_manager.write(
                characteristic_uuid=message.characteristic_uuid,
                data=data,
                with_response=message.with_response,
            )

            # Send status confirmation
            await self.send_status(
                connected=True, message=f"Wrote {len(data)} bytes to {message.characteristic_uuid}"
            )

        except Exception as e:
            logger.error(f"Write failed: {e}")
            await self.send_error(f"Write failed: {e}")

    async def handle_subscribe(self, message: BLESubscribeMessage) -> None:
        """Handle subscribe request."""
        try:

            async def notification_callback(char_uuid: str, data: bytes) -> None:
                """Forward notifications to WebSocket client."""
                response = BLENotificationMessage(
                    characteristic_uuid=char_uuid, data=base64.b64encode(data).decode("utf-8")
                )
                await self.send_message(response.model_dump())

            await self.ble_manager.subscribe(
                characteristic_uuid=message.characteristic_uuid, callback=notification_callback
            )

            await self.send_status(
                connected=True, message=f"Subscribed to {message.characteristic_uuid}"
            )

        except Exception as e:
            logger.error(f"Subscribe failed: {e}")
            await self.send_error(f"Subscribe failed: {e}")

    async def handle_unsubscribe(self, message: BLEUnsubscribeMessage) -> None:
        """Handle unsubscribe request."""
        try:
            await self.ble_manager.unsubscribe(characteristic_uuid=message.characteristic_uuid)

            await self.send_status(
                connected=True, message=f"Unsubscribed from {message.characteristic_uuid}"
            )

        except Exception as e:
            logger.error(f"Unsubscribe failed: {e}")
            await self.send_error(f"Unsubscribe failed: {e}")

    async def handle_discover(self, message: BLEDiscoverMessage) -> None:
        """Handle discovery request."""
        try:
            devices = await self.ble_manager.discover_devices(
                service_uuid=message.service_uuid, timeout=message.timeout
            )

            response = BLEDiscoveredMessage(devices=devices)
            await self.send_message(response.model_dump())

        except Exception as e:
            logger.error(f"Discovery failed: {e}")
            await self.send_error(f"Discovery failed: {e}")

    async def send_message(self, message: dict[str, Any]) -> None:
        """Send a message to the WebSocket client."""
        try:
            await self.websocket.send_json(message)
        except Exception as e:
            logger.error(f"Error sending message: {e}")
            self.running = False

    async def send_error(self, error: str, details: dict[str, Any] | None = None) -> None:
        """Send an error message to the client."""
        response = BLEErrorMessage(error=error, details=details)
        await self.send_message(response.model_dump())

    async def send_status(self, connected: bool, message: str) -> None:
        """Send a status message to the client."""
        device_name = None
        if self.ble_manager and self.ble_manager.is_connected:
            device_name = self.ble_manager.device_address

        response = BLEStatusMessage(connected=connected, device_name=device_name, message=message)
        await self.send_message(response.model_dump())


@router.websocket("/ws")
async def ble_proxy_websocket(websocket: WebSocket) -> None:
    """
    WebSocket endpoint for BLE proxy.

    Provides bidirectional communication for BLE operations.
    Clients can send commands and receive notifications.

    Path: /api/v1/ble/ws
    """
    handler = BLEProxyHandler(websocket)
    await handler.handle()
