import re
import unicodedata


ZONE_DISTRICTS = {
    "central": (
        "quan 1",
        "quan 3",
        "quan 4",
        "quan 5",
        "quan 10",
        "phu nhuan",
        "binh thanh",
    ),
    "northwest": (
        "quan 12",
        "hoc mon",
        "cu chi",
        "go vap",
        "tan binh",
        "tan phu",
    ),
    "west": (
        "quan 6",
        "quan 8",
        "quan 11",
        "binh tan",
        "binh chanh",
    ),
    "east": (
        "thu duc",
        "quan 2",
        "quan 9",
    ),
    "south": (
        "quan 7",
        "nha be",
        "can gio",
    ),
}


def normalize_region(value: str) -> str:
    ascii_value = unicodedata.normalize(
        "NFKD",
        value.replace("Đ", "D").replace("đ", "d"),
    )
    ascii_value = "".join(
        character for character in ascii_value if not unicodedata.combining(character)
    )
    return re.sub(r"[^a-z0-9]+", " ", ascii_value.lower()).strip()


def region_zone(value: str) -> str:
    normalized = normalize_region(value)
    if normalized in ZONE_DISTRICTS:
        return normalized

    for zone, districts in ZONE_DISTRICTS.items():
        if any(
            re.search(rf"\b{re.escape(district)}\b", normalized)
            for district in districts
        ):
            return zone
    return normalized


def regions_match(delivery_region: str, driver_region: str) -> bool:
    """Compare geocoded districts with the operating zones stored on vehicles."""
    delivery_zone = region_zone(delivery_region)
    driver_zone = region_zone(driver_region)
    if not delivery_zone or not driver_zone:
        return True
    return delivery_zone == driver_zone
