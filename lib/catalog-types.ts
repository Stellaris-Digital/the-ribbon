import type { Certainty } from "@/lib/dates";

export type CatalogLabel = {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  color: string;
  description: string | null;
  position: number;
};

export type CatalogPlaceName = {
  id: string;
  name: string;
  startYear: number | null;
  endYear: number | null;
};

export type CatalogPlace = {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  latitude: number | null;
  longitude: number | null;
  position: number;
  names: CatalogPlaceName[];
};

export type CatalogEndpoint = {
  year: number;
  month: number | null;
  day: number | null;
  certainty: Certainty;
};

export type CatalogEvent = {
  id: string;
  title: string;
  summary: string | null;
  citation: string | null;
  start: CatalogEndpoint;
  end: CatalogEndpoint | null;
  endOpen: boolean;
  labelIds: string[];
  placeIds: string[];
};

export type Catalog = {
  labels: CatalogLabel[];
  places: CatalogPlace[];
  events: CatalogEvent[];
};
