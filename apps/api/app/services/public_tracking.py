import secrets


def generate_tracking_token() -> str:
    """Return a high-entropy, URL-safe token suitable for a public tracking link."""
    return secrets.token_urlsafe(32)


def mask_customer_name(value: str) -> str:
    """Keep a name recognizable without exposing every component in full."""
    parts = [part for part in value.strip().split() if part]
    if not parts:
        return ""
    if len(parts) == 1:
        return f"{parts[0][0]}."
    if len(parts) == 2:
        return f"{parts[0]} {parts[1][0]}."
    middle = " ".join(f"{part[0]}." for part in parts[1:-1])
    return " ".join(part for part in (parts[0], middle, parts[-1]) if part)


def mask_phone_number(value: str | None) -> str | None:
    """Mask the center of a phone number while retaining call-recognition hints."""
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    if len(normalized) <= 6:
        return f"{'*' * max(len(normalized) - 2, 1)}{normalized[-2:]}"
    return f"{normalized[:3]}{'*' * (len(normalized) - 6)}{normalized[-3:]}"


def estimate_arrival_minutes(status: str, stops_remaining_before: int) -> int | None:
    """Provide a conservative demo ETA until live GPS telemetry is available."""
    if status == "ASSIGNED":
        return (stops_remaining_before + 1) * 20
    if status == "DELIVERING":
        return (stops_remaining_before + 1) * 15
    if status in {"DELIVERED", "FAILED"}:
        return 0
    return None
