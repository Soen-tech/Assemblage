export interface PromoCode {
  id: number;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_uses: number | null;
  times_used: number;
  active: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface PromoCodeRedemption {
  id: number;
  promo_code_id: number;
  order_id: string;
  user_id: string | null;
  redeemed_at: string;
}

export type View = 'home' | 'scan' | 'journal' | 'chat' | 'events' | 'boutique' | 'admin' | 'landing' | 'explore-clubs';

export type UserRole = 'member' | 'admin' | 'guest' | 'master_admin';

export interface ClubMembership {
  club_id: string;
  club_name: string;
  club_location?: string;
  club_image?: string;
  role: 'member' | 'admin';
  status: 'active' | 'pending' | 'suspended';
  joined_at: string;
  membership_type?: string;
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  clubId?: string;
  clubName?: string;
  username?: string;
  clubs?: ClubMembership[];
}

export interface Whisky {
  id: string;
  name: string;
  distillery: string;
  region: string;
  age: string;
  abv: string;
  description: string;
  tastingNotes: string[];
  category?: 'whisky' | 'wine';
  swriProfile: {
    peaty: number;
    fruity: number;
    floral: number;
    cereal: number;
    intensity: number;
    category?: 'whisky' | 'wine';
  };
  image: string;
  date?: string;
  rating?: number;
  tasteRating?: number;
  aromaRating?: number;
  valueRating?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  whisky?: Partial<Whisky>;
  timestamp: Date;
}

export interface Club {
  id: string;
  name: string;
  location: string;
  description: string;
  image: string;
  payfast_merchant_id?: string | null;
  joining_fee_monthly?: number | string | null;
  joining_fee_annual?: number | string | null;
}

export interface ClubEvent {
  id: string;
  title: string;
  date: string;
  location: string;
  price: string;
  image: string;
  category: 'masterclass' | 'tasting' | 'rare' | 'lounge' | 'dinner' | 'special';
  description: string;
  rating?: number;
  reviews?: number;
  payfast_price?: string | number | null;
  payfast_quantity?: number | null;
}
