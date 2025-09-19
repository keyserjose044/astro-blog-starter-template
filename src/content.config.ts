import { z, defineCollection } from "astro:content";

const toDate = (v: unknown) =>
  typeof v === "string" ? new Date(v) : (v as Date);

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.preprocess(toDate, z.date()),
    updatedDate: z.preprocess(toDate, z.date().optional()),
    heroImage: z.string().optional(),
    draft: z.boolean().optional().default(false),
  }),
});

export const collections = { blog };
