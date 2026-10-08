import { Whisky } from '../types';

export interface TextureDetails {
  key: 'crisp_vibrant_acidity' | 'velvety_full_bodied' | 'oily_rich_viscous' | 'silky_smooth_delicate' | 'peaty_smoky_intense' | 'fruity_bright_vibrant';
  label: string;
  value: string;
  localPath: string;
  fallbackUrl: string;
}

export function getTextureDetails(whisky: Whisky): TextureDetails {
  const isWine = whisky.category === 'wine' || whisky.swriProfile?.category === 'wine';

  if (isWine) {
    const isCrisp = Number(whisky.swriProfile?.floral || 5) > 6;
    if (isCrisp) {
      return {
        key: 'crisp_vibrant_acidity',
        label: 'PALATE STRUCTURE',
        value: 'Crisp & Vibrant Acidity',
        localPath: '/textures/crisp_vibrant_acidity.jpg',
        fallbackUrl: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&q=80&w=1200'
      };
    } else {
      return {
        key: 'velvety_full_bodied',
        label: 'PALATE STRUCTURE',
        value: 'Velvety & Full-Bodied',
        localPath: '/textures/velvety_full_bodied.jpg',
        fallbackUrl: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&q=80&w=1200'
      };
    }
  } else {
    // Whisky / spirits
    const isPeaty = Number(whisky.swriProfile?.peaty || 5) > 7;
    const isFruity = Number(whisky.swriProfile?.fruity || 5) > 7;
    const isOily = Number(whisky.swriProfile?.intensity || 5) >= 8;

    if (isPeaty) {
      return {
        key: 'peaty_smoky_intense',
        label: 'TEXTURE ANALYSIS',
        value: 'Peaty, Smoky & Intense',
        localPath: '/textures/peaty_smoky_intense.jpg',
        fallbackUrl: 'https://images.unsplash.com/photo-1579541591970-e5ad16d9a0be?auto=format&fit=crop&q=80&w=1200'
      };
    } else if (isFruity) {
      return {
        key: 'fruity_bright_vibrant',
        label: 'TEXTURE ANALYSIS',
        value: 'Fruity, Bright & Vibrant',
        localPath: '/textures/fruity_bright_vibrant.jpg',
        fallbackUrl: 'https://images.unsplash.com/photo-1615887023516-9b6bcd559e87?auto=format&fit=crop&q=80&w=1200'
      };
    } else if (isOily) {
      return {
        key: 'oily_rich_viscous',
        label: 'TEXTURE ANALYSIS',
        value: 'Oily, Rich & Viscous',
        localPath: '/textures/oily_rich_viscous.jpg',
        fallbackUrl: 'https://images.unsplash.com/photo-1596489389339-44d47f1548e2?auto=format&fit=crop&q=80&w=1200'
      };
    } else {
      return {
        key: 'silky_smooth_delicate',
        label: 'TEXTURE ANALYSIS',
        value: 'Silky, Smooth & Delicate',
        localPath: '/textures/silky_smooth_delicate.jpg',
        fallbackUrl: 'https://images.unsplash.com/photo-1527061011665-3652c757a4d4?auto=format&fit=crop&q=80&w=1200'
      };
    }
  }
}
