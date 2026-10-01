export interface PortfolioLink {
  label: string;
  url: string;
}

export interface PortfolioItem {
  id: number;
  title: string;
  description: string;
  techStack: string[];
  coverUrl: string;
  links: PortfolioLink[];
  /** 详情页长介绍(列表接口不含) */
  detailMd?: string;
}

export interface NewsItem {
  id: number;
  source: string;
  title: string;
  url: string;
  aiSummary: string;
  publishedAt: string | null;
}

export interface DigestListItem {
  date: string;
  itemCount: number;
}

export interface DigestDetail {
  date: string;
  summaryMd: string;
  model: string;
  itemCount: number;
  items: NewsItem[];
}
