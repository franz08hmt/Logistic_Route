from pathlib import Path
from uuid import UUID, uuid4


MAX_POD_BYTES = 5 * 1024 * 1024
CONTENT_TYPE_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def validate_pod_content(content: bytes, content_type: str) -> str:
    if content_type not in CONTENT_TYPE_EXTENSIONS:
        raise ValueError("POD must be a JPEG, PNG, or WebP image")
    if not content:
        raise ValueError("POD image is empty")
    if len(content) > MAX_POD_BYTES:
        raise ValueError("POD image exceeds the 5 MB limit")

    has_valid_signature = (
        content_type == "image/jpeg"
        and content.startswith(b"\xff\xd8\xff")
        or content_type == "image/png"
        and content.startswith(b"\x89PNG\r\n\x1a\n")
        or content_type == "image/webp"
        and len(content) >= 12
        and content.startswith(b"RIFF")
        and content[8:12] == b"WEBP"
    )
    if not has_valid_signature:
        raise ValueError("POD image content does not match its declared type")
    return CONTENT_TYPE_EXTENSIONS[content_type]


def store_pod_content(
    *,
    content: bytes,
    content_type: str,
    order_id: UUID,
    upload_dir: Path,
) -> tuple[str, int]:
    extension = validate_pod_content(content, content_type)
    upload_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{order_id}-{uuid4().hex}{extension}"
    (upload_dir / filename).write_bytes(content)
    return filename, len(content)
