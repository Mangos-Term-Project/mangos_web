"""Email verification codes and SMTP delivery.

Delivery uses plain SMTP so any provider works (Resend, SendGrid, Brevo,
Amazon SES and others all offer SMTP). Nothing is sent unless every SMTP
setting is present; the API then reports that email is not set up instead of
pretending a message was sent. Codes are never logged.
"""
import hashlib
import hmac
import logging
import os
import re
import secrets
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage

logger = logging.getLogger("mangos-api")

CODE_LENGTH = 6
CODE_TTL_MINUTES = 15
MAX_ATTEMPTS_PER_CODE = 5
RESEND_COOLDOWN_SECONDS = 60
MAX_CODES_PER_HOUR = 3
EMAIL_PATTERN = re.compile(r"[^@\s]{1,64}@[^@\s]{1,189}\.[^@\s.]{2,63}")


class EmailNotConfigured(Exception):
    pass


class EmailDeliveryFailed(Exception):
    pass


@dataclass(frozen=True)
class SmtpSettings:
    host: str
    port: int
    username: str
    password: str
    sender: str
    use_starttls: bool


def feature_enabled() -> bool:
    # Off unless turned on, because the under-13 email decision is still open.
    return os.getenv("EMAIL_VERIFICATION_ENABLED", "false").strip().lower() == "true"


def is_configured() -> bool:
    try:
        smtp_settings()
    except EmailNotConfigured:
        return False
    return True


def verification_required() -> bool:
    # Only enforce verification when a code can actually be delivered;
    # otherwise every account would be locked out with no way to verify.
    return feature_enabled() and is_configured()


def smtp_settings() -> SmtpSettings:
    host = os.getenv("SMTP_HOST", "").strip()
    sender = os.getenv("SMTP_FROM", "").strip()
    if not host or not sender:
        raise EmailNotConfigured()
    try:
        port = int(os.getenv("SMTP_PORT", "587"))
    except ValueError:
        raise EmailNotConfigured() from None
    return SmtpSettings(
        host=host,
        port=port,
        username=os.getenv("SMTP_USERNAME", "").strip(),
        password=os.getenv("SMTP_PASSWORD", ""),
        sender=sender,
        use_starttls=os.getenv("SMTP_STARTTLS", "true").strip().lower() == "true",
    )


def normalize_email(value: str) -> str | None:
    email = value.strip()
    if len(email) > 254 or not EMAIL_PATTERN.fullmatch(email):
        return None
    local, domain = email.rsplit("@", 1)
    return f"{local}@{domain.lower()}"


def mask_email(email: str) -> str:
    local, domain = email.rsplit("@", 1)
    return f"{local[0]}{'*' * max(len(local) - 1, 1)}@{domain}"


def generate_code() -> str:
    return f"{secrets.randbelow(10 ** CODE_LENGTH):0{CODE_LENGTH}d}"


def hash_code(code_id: str, code: str) -> str:
    return hashlib.sha256(f"{code_id}:{code}".encode()).hexdigest()


def code_matches(code_id: str, code: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_code(code_id, code), stored_hash)


def send_verification_email(to_address: str, code: str) -> None:
    settings = smtp_settings()
    message = EmailMessage()
    message["Subject"] = "Your Mangos verification code"
    message["From"] = settings.sender
    message["To"] = to_address
    message.set_content(
        f"Your Mangos verification code is {code}.\n\n"
        f"It expires in {CODE_TTL_MINUTES} minutes and works once.\n"
        "If you did not ask for this code, you can ignore this email.\n"
    )
    try:
        with smtplib.SMTP(settings.host, settings.port, timeout=10) as server:
            if settings.use_starttls:
                server.starttls()
            if settings.username:
                server.login(settings.username, settings.password)
            server.send_message(message)
    except (OSError, smtplib.SMTPException) as error:
        # Log the failure type only: never the address, code or credentials.
        logger.warning("Verification email failed (%s)", type(error).__name__)
        raise EmailDeliveryFailed() from None
