export interface Product {
  id: string;
  name: string;
  description: string;
  asin?: string; 
  price: string;
  category: string;
  image_url: string;
  affiliate_link: string;
  hidden?: boolean;
  // New Conversion Fields
  brand?: string;
  discount_percentage?: string;
  rating?: string;
  review_count?: string;
  highlights?: string[];
  description_bullets?: string[];
  trust_badge?: string;
  video_url?: string;
  images?: string[];
}

export interface Settings {
  affiliateTag: string;
  featuredCategory?: string;
}

export interface ClickEvent {
  asin: string;
  timestamp: string;
  userId?: string;
}
