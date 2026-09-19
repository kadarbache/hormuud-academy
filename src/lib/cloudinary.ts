import "server-only";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Photo upload is switched off until the three Cloudinary keys are in .env. */
export function photoUploadEnabled() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

function configure() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export async function uploadStudentPhoto(file: File) {
  configure();
  const bytes = Buffer.from(await file.arrayBuffer());

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: "hormuud-academy/students",
          resource_type: "image",
          // Phone photos are often 4000px wide. 600px is plenty for a profile.
          transformation: [{ width: 600, height: 600, crop: "limit" }],
        },
        (error, response) => {
          if (error || !response) reject(error ?? new Error("Upload failed"));
          else resolve(response);
        },
      )
      .end(bytes);
  });

  return { url: result.secure_url, publicId: result.public_id };
}

export async function deleteStudentPhoto(publicId: string) {
  configure();
  await cloudinary.uploader.destroy(publicId);
}
