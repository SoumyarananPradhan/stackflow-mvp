export interface Product {
  id: number;
  organization: number;
  name: string;
  sku: string;
  description: string;
  quantity_on_hand: number;
  cost_price: string | null;
  selling_price: string | null;
  low_stock_threshold: number | null;
  last_updated_by: number | null;
  created_at: string;
  updated_at: string;
  effective_threshold: number;
  is_low_stock: boolean;
}

export interface ProductListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Product[];
}
