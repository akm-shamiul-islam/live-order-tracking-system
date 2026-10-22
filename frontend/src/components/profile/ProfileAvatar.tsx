import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useCopy } from '../../lib/i18n';
import { api } from '../../lib/api';
import { UserRound } from 'lucide-react';

export function ProfileAvatar({
  photoId,
  source,
  name,
  className = 'h-20 w-20',
}: {
  photoId?: string | null;
  source?: string | null;
  name: string;
  className?: string;
}) {
  const c = useCopy();
  const { user } = useAuth();
  const [failedImage, setFailedImage] = useState<string>();
  const photo = useQuery({
    queryKey: ['profile-photo', user?.id, photoId],
    queryFn: ({ signal }) => api.profile.photo(photoId!, signal),
    enabled: !!user && !!photoId && !source,
    staleTime: Infinity,
    retry: false,
  });
  const image = source || photo.data;
  const showImage = !!image && failedImage !== image;
  return (
    <span
      role="img"
      aria-label={name || c('Profile Photo')}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-200 ${className}`}
    >
      {showImage ? (
        <img
          src={image}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
          onError={() => setFailedImage(image)}
        />
      ) : (
        <UserRound aria-hidden="true" className="h-1/2 w-1/2" />
      )}
    </span>
  );
}
