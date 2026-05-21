const CLOUDINARY_CLOUD_NAME = 'dsqjqaacq';
const CLOUDINARY_UPLOAD_PRESET = 'kopiornew';

export async function uploadToCloudinary(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal upload gambar');
  }
  const data = await response.json();
  return data.secure_url as string;
}
