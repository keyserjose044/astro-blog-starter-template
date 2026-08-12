import { getDailyMeta, getYears } from './dailyData';
import type { DailyMeta, DailyRecord } from './dailyData';

export type PursuitsArchive = {
  meta: DailyMeta;
  records: DailyRecord[];
};

let archivePromise: Promise<PursuitsArchive> | null = null;

export function getPursuitsArchive(): Promise<PursuitsArchive> {
  if (!archivePromise) {
    archivePromise = getDailyMeta()
      .then(async (meta) => ({ meta, records: await getYears(meta.availableYears) }))
      .catch((error) => {
        archivePromise = null;
        throw error;
      });
  }
  return archivePromise;
}
