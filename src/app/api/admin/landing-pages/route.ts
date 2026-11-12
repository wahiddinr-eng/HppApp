import { z } from "zod";
import { landingPageInputSchema } from "@/lib/landing-builder";
import { deleteLandingPage, getLandingPage, listLandingPages, saveLandingPage } from "@/server/landing-pages";
import { apiError, checkOrigin, DomainError, privateJson, readJson, requireActor } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";

const updateSchema = landingPageInputSchema.safeExtend({ id: z.uuid(), expectedVersion: z.number().int().positive() });
const deleteSchema = z.object({ id: z.uuid(), expectedVersion: z.number().int().positive() });

export async function GET(request: Request) {
  try {
    await requireActor(request, "admin");
    const id = new URL(request.url).searchParams.get("id");
    return id ? privateJson({ page: await getLandingPage(id) }) : privateJson({ pages: await listLandingPages() });
  }
  catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request, "admin");
    await rateLimit(`admin-landing:${actor.id}`, 30, 60);
    const parsed = landingPageInputSchema.safeParse(await readJson(request, 800_000));
    if (!parsed.success) throw new DomainError(422, "INVALID_LANDING_PAGE", parsed.error.issues[0]?.message || "Periksa isi landing page.");
    return privateJson({ page: await saveLandingPage(parsed.data, actor.id) }, 201);
  } catch (error) { return apiError(error); }
}

export async function PUT(request: Request) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request, "admin");
    await rateLimit(`admin-landing:${actor.id}`, 30, 60);
    const parsed = updateSchema.safeParse(await readJson(request, 800_000));
    if (!parsed.success) throw new DomainError(422, "INVALID_LANDING_PAGE", parsed.error.issues[0]?.message || "Periksa isi landing page.");
    const { id, expectedVersion, ...input } = parsed.data;
    return privateJson({ page: await saveLandingPage(input, actor.id, id, expectedVersion) });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request, "admin");
    await rateLimit(`admin-landing:${actor.id}`, 30, 60);
    const parsed = deleteSchema.safeParse(await readJson(request, 4096));
    if (!parsed.success) throw new DomainError(422, "INVALID_LANDING_PAGE", "ID dan versi halaman diperlukan.");
    await deleteLandingPage(parsed.data.id, parsed.data.expectedVersion, actor.id);
    return privateJson({ message: "Landing page dihapus." });
  } catch (error) { return apiError(error); }
}
