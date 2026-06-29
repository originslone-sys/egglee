"""Cliente R2 (Cloudflare, S3-compatível) para a biblioteca de mídia."""
import os
import boto3
from botocore.config import Config

R2_ENDPOINT = os.environ.get("R2_ENDPOINT", "").strip()
R2_ACCESS_KEY = os.environ.get("R2_ACCESS_KEY", "").strip()
R2_SECRET_KEY = os.environ.get("R2_SECRET_KEY", "").strip()
R2_BUCKET = os.environ.get("R2_BUCKET", "").strip()

_client = None


def enabled() -> bool:
    return bool(R2_ENDPOINT and R2_ACCESS_KEY and R2_SECRET_KEY and R2_BUCKET)


def client():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=R2_ENDPOINT,
            aws_access_key_id=R2_ACCESS_KEY,
            aws_secret_access_key=R2_SECRET_KEY,
            config=Config(signature_version="s3v4"),
            region_name="auto",
        )
    return _client


def upload_bytes(key: str, data: bytes, content_type: str = "image/png"):
    client().put_object(Bucket=R2_BUCKET, Key=key, Body=data, ContentType=content_type)


def delete_key(key: str):
    client().delete_object(Bucket=R2_BUCKET, Key=key)


def exists(key: str) -> bool:
    try:
        client().head_object(Bucket=R2_BUCKET, Key=key)
        return True
    except Exception:
        return False


def get_bytes(key: str) -> bytes:
    obj = client().get_object(Bucket=R2_BUCKET, Key=key)
    return obj["Body"].read()


def presigned_url(key: str, expires: int = 3600) -> str:
    return client().generate_presigned_url(
        "get_object", Params={"Bucket": R2_BUCKET, "Key": key}, ExpiresIn=expires
    )
