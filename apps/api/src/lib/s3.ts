import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

let s3: S3Client | null = null;

export function getS3(): S3Client | null {
  if (!process.env.S3_ENDPOINT || !process.env.S3_ACCESS_KEY || !process.env.S3_SECRET_KEY) {
    return null;
  }

  if (!s3) {
    s3 = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
      },
      forcePathStyle: true, // Required for MinIO / S3-compatible stores
    });
  }
  return s3;
}

function getBucket(): string {
  return process.env.S3_BUCKET || "dotted-uploads";
}

export function generateKey(folder: string, originalName: string): string {
  const ext = originalName.split(".").pop() || "bin";
  const hash = crypto.randomBytes(16).toString("hex");
  return `${folder}/${hash}.${ext}`;
}

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string | null> {
  const client = getS3();
  if (!client) return null;

  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  return `${process.env.S3_ENDPOINT}/${getBucket()}/${key}`;
}

export async function deleteFile(key: string): Promise<boolean> {
  const client = getS3();
  if (!client) return false;

  try {
    await client.send(
      new DeleteObjectCommand({ Bucket: getBucket(), Key: key })
    );
    return true;
  } catch {
    return false;
  }
}

export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string | null> {
  const client = getS3();
  if (!client) return null;

  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
    { expiresIn }
  );
}
