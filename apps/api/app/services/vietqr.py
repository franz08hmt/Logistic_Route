"""Dynamic VietQR (NAPAS 24/7) payload generation for COD collection.

The QR payload is built locally following the EMVCo merchant-presented QR
specification that NAPAS profiles for VietQR. Building the payload here rather
than embedding a remote ``img.vietqr.io`` image matters for two reasons that
show up in the warehouse: a printed delivery bill renders the code even with no
internet connection, and no order code, amount, or customer context is sent to a
third-party host on every render.

The rendered image itself is produced client-side from :func:`build_vietqr_payload`
output. ``build_vietqr_image_url`` is kept as an online fallback only.
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass
from decimal import Decimal
from urllib.parse import quote


# NAPAS globally unique identifier for the VietQR beneficiary template.
NAPAS_GUID = "A000000727"
# Inter-bank fund transfer to a bank account (as opposed to a card).
SERVICE_CODE_ACCOUNT = "QRIBFTTA"
VND_CURRENCY_CODE = "704"
COUNTRY_CODE = "VN"

# Acquirer (bank) identifiers used by NAPAS. Short codes are what operators
# recognise; the payload needs the six digit BIN.
BANK_BIN_BY_CODE: dict[str, str] = {
    "VCB": "970436",
    "VIETCOMBANK": "970436",
    "TCB": "970407",
    "TECHCOMBANK": "970407",
    "BIDV": "970418",
    "VIETINBANK": "970415",
    "ICB": "970415",
    "MB": "970422",
    "MBBANK": "970422",
    "ACB": "970416",
    "VPB": "970432",
    "VPBANK": "970432",
    "TPB": "970423",
    "TPBANK": "970423",
    "SACOMBANK": "970403",
    "STB": "970403",
    "AGRIBANK": "970405",
    "VBA": "970405",
    "HDB": "970437",
    "HDBANK": "970437",
    "OCB": "970448",
    "MSB": "970426",
    "SHB": "970443",
    "EIB": "970431",
    "EXIMBANK": "970431",
    "VIB": "970441",
    "SCB": "970429",
    "SEAB": "970440",
    "SEABANK": "970440",
}


@dataclass(frozen=True)
class VietQrAccount:
    """Beneficiary account a customer transfers COD money to."""

    bank_code: str
    account_no: str
    account_name: str

    @property
    def bank_bin(self) -> str:
        return resolve_bank_bin(self.bank_code)


def resolve_bank_bin(bank_code: str) -> str:
    """Map a bank short code to its NAPAS BIN, accepting a raw BIN as-is."""
    normalized = (bank_code or "").strip().upper()
    if normalized.isdigit() and len(normalized) == 6:
        return normalized
    bin_code = BANK_BIN_BY_CODE.get(normalized)
    if bin_code is None:
        raise ValueError(f"Unknown VietQR bank code: {bank_code!r}")
    return bin_code


def _field(tag: str, value: str) -> str:
    """Encode one EMVCo tag-length-value field."""
    if len(value) > 99:
        raise ValueError(f"VietQR field {tag} exceeds the 99 character limit")
    return f"{tag}{len(value):02d}{value}"


def crc16_ccitt(payload: str) -> str:
    """CRC-16/CCITT-FALSE checksum required by EMVCo tag 63."""
    crc = 0xFFFF
    for byte in payload.encode("utf-8"):
        crc ^= byte << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return f"{crc:04X}"


def normalize_add_info(value: str) -> str:
    """Reduce a transfer memo to the ASCII subset Vietnamese banks accept."""
    folded = (
        value.replace("Đ", "D")
        .replace("đ", "d")
    )
    decomposed = unicodedata.normalize("NFD", folded)
    ascii_only = "".join(
        char for char in decomposed if unicodedata.category(char) != "Mn"
    )
    cleaned = "".join(
        char if char.isalnum() or char in " -_." else " " for char in ascii_only
    )
    return " ".join(cleaned.split())[:99]


def build_vietqr_payload(
    *,
    account: VietQrAccount,
    amount: Decimal | int,
    add_info: str,
) -> str:
    """Build the EMVCo string a banking app scans to prefill a COD transfer."""
    amount_value = int(Decimal(amount))
    if amount_value <= 0:
        raise ValueError("VietQR amount must be greater than zero")

    beneficiary = _field("00", account.bank_bin) + _field("01", account.account_no)
    merchant_account = (
        _field("00", NAPAS_GUID)
        + _field("01", beneficiary)
        + _field("02", SERVICE_CODE_ACCOUNT)
    )

    payload = (
        _field("00", "01")
        # "12" marks a dynamic, single-use code because it carries an amount.
        + _field("01", "12")
        + _field("38", merchant_account)
        + _field("53", VND_CURRENCY_CODE)
        + _field("54", str(amount_value))
        + _field("58", COUNTRY_CODE)
        + _field("62", _field("08", normalize_add_info(add_info)))
    )
    unchecked = f"{payload}6304"
    return f"{unchecked}{crc16_ccitt(unchecked)}"


def build_vietqr_image_url(
    *,
    account: VietQrAccount,
    amount: Decimal | int,
    add_info: str,
) -> str:
    """Hosted VietQR image, offered only as an online fallback link."""
    amount_value = int(Decimal(amount))
    return (
        f"https://img.vietqr.io/image/{account.bank_bin}-{account.account_no}"
        f"-compact2.png?amount={amount_value}"
        f"&addInfo={quote(normalize_add_info(add_info))}"
        f"&accountName={quote(account.account_name)}"
    )
