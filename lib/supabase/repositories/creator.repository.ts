import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreatorLaunch,
  CreatorOffer,
  CreatorProduct,
  CreatorValidation,
  Database,
} from "@/types/database";
import { BaseRepository } from "./base.repository";

export class CreatorProductsRepository extends BaseRepository<"creator_products"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "creator_products", userId);
  }

  async findAllWithRelations() {
    const { data: products, error } = await this.supabase
      .from("creator_products")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });

    if (error) {
      return { data: null, error: error.message };
    }

    const rows = (products as CreatorProduct[]) ?? [];
    if (rows.length === 0) {
      return { data: [], error: null };
    }

    const ids = rows.map((p) => p.id);

    const [validations, offers, launches] = await Promise.all([
      this.supabase
        .from("creator_validation")
        .select("*")
        .eq("user_id", this.userId)
        .in("product_id", ids),
      this.supabase
        .from("creator_offers")
        .select("*")
        .eq("user_id", this.userId)
        .in("product_id", ids),
      this.supabase
        .from("creator_launches")
        .select("*")
        .eq("user_id", this.userId)
        .in("product_id", ids),
    ]);

    const validationByProduct = new Map(
      ((validations.data as CreatorValidation[]) ?? []).map((v) => [v.product_id, v])
    );
    const offerByProduct = new Map(
      ((offers.data as CreatorOffer[]) ?? []).map((o) => [o.product_id, o])
    );
    const launchByProduct = new Map(
      ((launches.data as CreatorLaunch[]) ?? []).map((l) => [l.product_id, l])
    );

    return {
      data: rows.map((product) => ({
        product,
        validation: validationByProduct.get(product.id) ?? null,
        offer: offerByProduct.get(product.id) ?? null,
        launch: launchByProduct.get(product.id) ?? null,
      })),
      error: null,
    };
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from("creator_products")
      .select("*")
      .eq("user_id", this.userId)
      .eq("id", id)
      .maybeSingle();

    return {
      data: (data as CreatorProduct | null) ?? null,
      error: error?.message ?? null,
    };
  }
}

export class CreatorValidationRepository extends BaseRepository<"creator_validation"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "creator_validation", userId);
  }

  async findByProductId(productId: string) {
    const { data, error } = await this.supabase
      .from("creator_validation")
      .select("*")
      .eq("user_id", this.userId)
      .eq("product_id", productId)
      .maybeSingle();

    return {
      data: (data as CreatorValidation | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async upsertForProduct(
    productId: string,
    payload: Omit<
      import("@/types/database").TableInsert<"creator_validation">,
      "user_id" | "product_id"
    >
  ) {
    const existing = await this.findByProductId(productId);
    if (existing.data) {
      return this.update(existing.data.id, payload);
    }
    return this.create({ ...payload, product_id: productId });
  }
}

export class CreatorOffersRepository extends BaseRepository<"creator_offers"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "creator_offers", userId);
  }

  async findByProductId(productId: string) {
    const { data, error } = await this.supabase
      .from("creator_offers")
      .select("*")
      .eq("user_id", this.userId)
      .eq("product_id", productId)
      .maybeSingle();

    return {
      data: (data as CreatorOffer | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async upsertForProduct(
    productId: string,
    payload: Omit<
      import("@/types/database").TableInsert<"creator_offers">,
      "user_id" | "product_id"
    >
  ) {
    const existing = await this.findByProductId(productId);
    if (existing.data) {
      return this.update(existing.data.id, payload);
    }
    return this.create({ ...payload, product_id: productId });
  }
}

export class CreatorLaunchesRepository extends BaseRepository<"creator_launches"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "creator_launches", userId);
  }

  async upsertForProduct(
    productId: string,
    payload: Omit<
      import("@/types/database").TableInsert<"creator_launches">,
      "user_id" | "product_id"
    >
  ) {
    const { data: existing } = await this.supabase
      .from("creator_launches")
      .select("id")
      .eq("user_id", this.userId)
      .eq("product_id", productId)
      .maybeSingle();

    if (existing) {
      return this.update(existing.id, payload);
    }
    return this.create({ ...payload, product_id: productId });
  }
}
