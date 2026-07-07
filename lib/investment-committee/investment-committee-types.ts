import type { ProductBuildBrief } from "@/utils/product-build-brief";
import type { MasterFlowMetadata } from "@/utils/master-flow";
import type { SalesPackage } from "@/utils/sales-system";

export type InvestmentSpecialistName =
  | "CEO"
  | "CMO"
  | "Copy Chief"
  | "Product Specialist"
  | "Performance Manager";

export type InvestmentSpecialistReview = {
  name: InvestmentSpecialistName;
  score: number;
  approved: boolean;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
};

export type InvestmentCommitteeReport = {
  investmentScore: number;
  approved: boolean;
  specialists: InvestmentSpecialistReview[];
  globalRecommendation: string;
  mustFix: string[];
};

export type InvestmentCommitteeInput = {
  salesPackage: SalesPackage;
  meta: MasterFlowMetadata;
  productBuildBrief?: ProductBuildBrief | null;
};
