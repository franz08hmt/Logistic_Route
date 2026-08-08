from pathlib import Path
from uuid import UUID, uuid4


MAX_SIGNATURE_BYTES = 1024 * 1024
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def validate_signature_content(content: bytes, content_type: str) -> None:
    """Validate the bounded PNG payload produced by the browser canvas."""
    if content_type.lower() != "image/png":
        raise ValueError("Signature must be a PNG image")
    if not content:
        raise ValueError("Signature PNG is empty")
    if len(content) > MAX_SIGNATURE_BYTES:
        raise ValueError("Signature PNG exceeds the 1 MB limit")
    if not content.startswith(PNG_SIGNATURE) or b"IEND" not in content[-16:]:
        raise ValueError("Signature PNG content is invalid")


def store_signature_content(
    *,
    content: bytes,
    content_type: str,
    order_id: UUID,
    upload_dir: Path,
) -> str:
    """Store one validated signature under a server-generated filename."""
    validate_signature_content(content, content_type)
    upload_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{order_id.hex}-{uuid4().hex}.png"
    temporary_path = upload_dir / f".{filename}.tmp"
    temporary_path.write_bytes(content)
    temporary_path.replace(upload_dir / filename)
    return filename


if __name__ == "__main__":
    print("Signature storage validates PNG canvas uploads up to 1 MB.")
