import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "node:stream";
import { createWriteStream, createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { env, mustEnv } from "@/lib/config";

let client: S3Client | null = null;
function s3() {
  if (!client) {
    client = new S3Client({
      endpoint: mustEnv("S3_ENDPOINT"),
      region: env("S3_REGION", "auto"),
      forcePathStyle: env("S3_FORCE_PATH_STYLE", "false") === "true",
      credentials: { accessKeyId: mustEnv("S3_ACCESS_KEY"), secretAccessKey: mustEnv("S3_SECRET_KEY") }
    });
  }
  return client;
}
function bucket() { return mustEnv("S3_BUCKET"); }

export async function createUploadUrl(key: string, contentType: string) {
  return getSignedUrl(s3(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }), { expiresIn: 900 });
}
export async function createDownloadUrl(key: string) {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: 900 });
}
export async function headObject(key: string) {
  return s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
}
export async function downloadToFile(key: string, output: string) {
  const res = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!res.Body) throw new Error("Storage object has no body");
  await pipeline(res.Body as Readable, createWriteStream(output));
}
export async function uploadFile(key: string, file: string, contentType: string) {
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: createReadStream(file), ContentType: contentType }));
}
export async function uploadBuffer(key: string, body: Buffer, contentType: string) {
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }));
}
