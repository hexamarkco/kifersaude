import { useState } from 'react';
import { getImageFileError } from '../../../../lib/imageCrop';
import { uploadLinkPageImage } from '../../../../lib/imageUploadService';
import { toast } from '../../../../lib/toast';

export function useProfilePhoto(onUploaded: (url: string) => void) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const selectPhoto = (selectedFile: File) => {
    const error = getImageFileError(selectedFile);
    if (error) { toast.error(error); return; }
    setFile(selectedFile);
  };

  const uploadPhoto = async (croppedFile: File) => {
    setUploading(true);
    try {
      const result = await uploadLinkPageImage(croppedFile);
      if (!result.success || !result.url) throw new Error('Não foi possível enviar a foto. Verifique sua conexão e tente novamente.');
      onUploaded(result.url);
      setFile(null);
    } finally { setUploading(false); }
  };

  return { file, uploading, selectPhoto, uploadPhoto, cancel: () => setFile(null) };
}
