import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  ProductComplianceCheck,
  ProductFactory,
  ProductFile,
  ProductVersion,
} from "@/types/database";
import { BaseRepository } from "./base.repository";

export class ProductFactoryRepository extends BaseRepository<"product_factory"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "product_factory", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("product_factory")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });

    return {
      data: (data as ProductFactory[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from("product_factory")
      .select("*")
      .eq("user_id", this.userId)
      .eq("id", id)
      .maybeSingle();

    return {
      data: (data as ProductFactory | null) ?? null,
      error: error?.message ?? null,
    };
  }
}

export class ProductFilesRepository extends BaseRepository<"product_files"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "product_files", userId);
  }

  async findByFactoryId(factoryId: string) {
    const { data, error } = await this.supabase
      .from("product_files")
      .select("*")
      .eq("user_id", this.userId)
      .eq("factory_id", factoryId)
      .order("version_number", { ascending: false });

    return {
      data: (data as ProductFile[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findLatestPdf(factoryId: string) {
    const { data, error } = await this.supabase
      .from("product_files")
      .select("*")
      .eq("user_id", this.userId)
      .eq("factory_id", factoryId)
      .eq("file_type", "pdf")
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      data: (data as ProductFile | null) ?? null,
      error: error?.message ?? null,
    };
  }
}

export class ProductVersionsRepository extends BaseRepository<"product_versions"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "product_versions", userId);
  }

  async findByFactoryId(factoryId: string) {
    const { data, error } = await this.supabase
      .from("product_versions")
      .select("*")
      .eq("user_id", this.userId)
      .eq("factory_id", factoryId)
      .order("version_number", { ascending: false });

    return {
      data: (data as ProductVersion[]) ?? null,
      error: error?.message ?? null,
    };
  }
}

export class ProductComplianceChecksRepository extends BaseRepository<"product_compliance_checks"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "product_compliance_checks", userId);
  }

  async findLatestByFactoryId(factoryId: string) {
    const { data, error } = await this.supabase
      .from("product_compliance_checks")
      .select("*")
      .eq("user_id", this.userId)
      .eq("factory_id", factoryId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      data: (data as ProductComplianceCheck | null) ?? null,
      error: error?.message ?? null,
    };
  }
}
